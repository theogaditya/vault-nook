/**
 * Nook Worker Security & Auth Middleware
 */

import { Env, AuthenticatedRequest, SessionRecord, UserRecord, DeviceRecord } from '../types';
import { D1Service } from '../services/d1';

export const COOKIE_NAME = 'nook_session';

// Apply Security Headers to Response
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; frame-src 'self' https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com;"
  );

  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Parse Cookies helper
export function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');

  for (const pair of pairs) {
    const [key, value] = pair.trim().split('=');
    if (key && value) {
      cookies[key] = decodeURIComponent(value);
    }
  }

  return cookies;
}

// Hash Session Token using SHA-256 for secure database lookup
export async function hashSessionToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Timing-safe string comparison using HMAC to prevent timing oracle attacks.
 * Safe against both length and content timing leaks.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  // Use a fresh random HMAC key so the attacker cannot predict the output
  const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, aBytes),
    crypto.subtle.sign('HMAC', key, bBytes),
  ]);

  const aArr = new Uint8Array(sigA);
  const bArr = new Uint8Array(sigB);
  let diff = 0;
  for (let i = 0; i < aArr.length; i++) diff |= aArr[i] ^ bArr[i];
  // Also enforce length equality to reject different-length inputs
  return diff === 0 && aBytes.length === bBytes.length;
}

// Session Validation Middleware
export async function authenticateRequest(
  request: AuthenticatedRequest,
  env: Env
): Promise<{ user: UserRecord; session: SessionRecord; device?: DeviceRecord } | null> {
  const cookies = parseCookies(request);
  // Accept both old cookie name (myvault_session) and new (nook_session) for backward compat
  const sessionToken = cookies[COOKIE_NAME] || cookies['myvault_session'];

  if (!sessionToken) return null;

  const d1 = new D1Service(env.DB);
  const tokenHash = await hashSessionToken(sessionToken);

  const session = await d1.getSessionByTokenHash(tokenHash);
  if (!session) return null;

  // Verify User
  const user = await d1.getOrCreateUser(session.user_id);

  // Update session last seen timestamp
  await d1.updateSessionLastSeen(session.id);

  request.user = user;
  request.session = session;

  return { user, session };
}

// Create Session Cookie String
export function createSessionCookie(token: string, maxAgeSeconds = 30 * 24 * 60 * 60): string {
  return `${COOKIE_NAME}=${encodeURIComponent(
    token
  )}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

// Clear Session Cookie String (clears both old and new cookie names)
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// ─── D1-Backed Cross-Instance Rate Limiter ───
// Replaces in-memory rateLimitMap — works across all Cloudflare edge instances
// and survives Worker cold starts.

export async function checkRateLimitD1(
  db: D1Database,
  request: Request,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '127.0.0.1';
  const key = `${action}:${ip}`;
  const d1 = new D1Service(db);
  return d1.checkAndIncrementRateLimit(key, limit, windowSeconds);
}

/**
 * Dedicated Vault Unlock / Auth Rate Limiter — D1-backed, cross-instance
 * Enforces max 10 attempts per IP; if exceeded, blocks unlock attempts for 15 minutes (900s).
 */
export async function checkUnlockRateLimitD1(
  db: D1Database,
  request: Request
): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '127.0.0.1';
  const key = `unlock_attempts:${ip}`;
  const d1 = new D1Service(db);
  return d1.checkAndIncrementRateLimit(key, 10, 900);
}

// Keep legacy in-memory version for non-security-critical fast paths only
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(request: Request, action: string, limit: number, windowSeconds: number): boolean {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '127.0.0.1';
  const key = `${action}:${ip}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}

export function getRateLimitKey(request: Request, action: string): string {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return `rate:${action}:${ip}`;
}

/**
 * Verify Cloudflare Turnstile Token
 */
export async function verifyTurnstileToken(token: string, ip: string, env: Env): Promise<{ success: boolean; error?: string }> {
  if (!token) {
    return { success: false, error: 'Turnstile verification token is required.' };
  }

  const secretKey = env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.warn('TURNSTILE_SECRET_KEY is missing from environment bindings.');
    return { success: false, error: 'Server security configuration error.' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const outcome = await res.json() as any;
    if (outcome.success) {
      return { success: true };
    } else {
      return { success: false, error: outcome['error-codes']?.join(', ') || 'Turnstile bot challenge failed.' };
    }
  } catch (err: any) {
    console.error('Turnstile verification error:', err);
    return { success: false, error: 'Failed to verify Turnstile challenge.' };
  }
}

/**
 * Detect CGNAT / Mobile Carrier / Shared ISP range via Cloudflare request metadata
 */
export function isCGNATOrCarrierIP(request: Request): boolean {
  const cf = (request as any).cf;
  if (!cf) return false;

  const org = (cf.asOrganization || cf.isp || '').toLowerCase();
  const asn = cf.asn;

  // Common mobile carrier & CGNAT keywords
  const carrierKeywords = [
    'mobile', 'cellular', 'wireless', 'cgnat', 'carrier', 'telecom', 'telekom',
    'telefonica', 'jio', 'airtel', 'vodafone', 'orange', 't-mobile', 'verizon',
    'at&t', 'sprint', 'claro', 'telstra', 'singtel', 'mtn', 'stc', 'softbank',
    'docomo', 'kddi', 'comcast', 'charter', 'cox', 'ee', 'o2', 'three'
  ];

  if (carrierKeywords.some(kw => org.includes(kw))) {
    return true;
  }

  // Known CGNAT ASN ranges or high-volume consumer pools
  const knownCarrierASNs = [7018, 22773, 20115, 55836, 45609, 9829, 23969, 11427, 22394];
  if (knownCarrierASNs.includes(asn)) {
    return true;
  }

  return false;
}

/**
 * Account Registration Rate Limiter (24-hour window) — D1-backed, cross-instance.
 * - Standard IP: 5 signups per 24 hours
 * - CGNAT / Mobile Carrier range: 25 signups per 24 hours (paired with Turnstile + PoW)
 */
export async function checkRegistrationRateLimitD1(
  db: D1Database,
  request: Request
): Promise<{ allowed: boolean; limit: number; isCarrier: boolean }> {
  const isCarrier = isCGNATOrCarrierIP(request);
  const limit = isCarrier ? 25 : 5;
  const allowed = await checkRateLimitD1(db, request, 'registration_24h', limit, 86400);
  return { allowed, limit, isCarrier };
}
