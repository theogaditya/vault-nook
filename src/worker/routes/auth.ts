/**
 * Nook Auth Router — Passkey-first, device-is-the-key identity model.
 * Passkeys = identity + auth. Passphrase = encryption only (never sent to server).
 */

import { Env, AuthenticatedRequest } from '../types';
import { D1Service } from '../services/d1';
import { authenticateRequest, createSessionCookie, clearSessionCookie, hashSessionToken, checkRateLimitD1, checkUnlockRateLimitD1, verifyTurnstileToken, checkRegistrationRateLimitD1 } from '../middleware/security';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { arrayBufferToBase64Url, base64UrlToArrayBuffer } from '../../crypto/keys';
import { generatePoWChallenge, verifyPoWSolution } from '../../crypto/pow';

const RP_NAME = 'Nook';

async function createUserSession(d1: D1Service, userId: string, deviceId: string, deviceName: string, request: Request) {
  const activeSessions = await d1.getActiveSessions(userId);
  const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
  const userAgent = request.headers.get('User-Agent') || 'Unknown';

  // Check if re-logging in from an existing active device session (same User-Agent signature)
  const existingSameDeviceSession = activeSessions.find(s => s.user_agent === userAgent);

  if (existingSameDeviceSession) {
    // Re-authenticating on an existing device: revoke old session for this device so count doesn't increase
    await d1.revokeSession(existingSameDeviceSession.id, userId);
  } else if (activeSessions.length >= 3) {
    // 4th unique device attempting to connect: strictly block
    throw new Error('Active device limit reached (3 / 3 max connected devices). Please revoke an existing session from your account settings before connecting a 4th device.');
  }

  const rawSessionToken = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = await hashSessionToken(rawSessionToken);
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

  const session = await d1.createSession({
    id: crypto.randomUUID(), user_id: userId, device_id: deviceId,
    token_hash: tokenHash, ip_address: clientIp,
    user_agent: userAgent, expires_at: expiresAt,
  });

  await d1.createAuditLog({
    user_id: userId, device_id: deviceId, event_type: 'LOGIN_SUCCESS',
    ip_address: clientIp,
    user_agent: userAgent,
    details: `Login via ${deviceName}`,
  });

  return { session, rawSessionToken };
}

export async function handleAuthRoutes(request: AuthenticatedRequest, env: Env, url: URL): Promise<Response> {
  // General auth rate limit — D1-backed to survive cross-instance and cold starts
  if (!(await checkRateLimitD1(env.DB, request, 'auth', 60, 60))) {
    return Response.json({ error: 'Too many authentication requests. Please wait a minute.' }, { status: 429 });
  }

  const d1 = new D1Service(env.DB);
  const path = url.pathname;

  // ─── 0. GET /api/auth/pow-challenge — Issue fresh Proof-of-Work challenge for account creation ───
  if (path === '/api/auth/pow-challenge' && request.method === 'GET') {
    const pow = generatePoWChallenge(4);
    return Response.json(pow);
  }

  // ─── 1. GET /api/auth/me — Check current session ───
  if (path === '/api/auth/me' && request.method === 'GET') {
    const auth = await authenticateRequest(request, env);
    if (!auth) return Response.json({ authenticated: false });
    const user = await d1.getUserById(auth.user.id);
    const devices = await d1.getDevicesByUser(auth.user.id);
    const recovery = await d1.getRecoveryMaterial(auth.user.id);

    const defaultQuota = auth.user.id === 'user_ae71159c13ca4ba78b0b24ccd827a5b3' ? 2147483648 : 524288000;
    return Response.json({
      authenticated: true,
      user: {
        id: auth.user.id, userSalt: user?.user_salt || user?.id || '',
        storageUsedBytes: user?.storage_used_bytes || 0,
        storageQuotaBytes: user?.storage_quota_bytes || defaultQuota,
        devicesCount: devices.length, hasRecovery: !!recovery,
      },
    });
  }

  // ─── 2. POST /api/auth/register-passkey/options — Start passkey registration (new vault) ───
  if (path === '/api/auth/register-passkey/options' && request.method === 'POST') {
    const auth = await authenticateRequest(request, env);

    // If new user registration (unauthenticated), enforce anti-bot checks & rate limits
    if (!auth) {
      // 1. IP Rate Limiting via D1 (5/24h standard, 25/24h for mobile CGNAT ranges) — cross-instance
      const rateLimitResult = await checkRegistrationRateLimitD1(env.DB, request);
      if (!rateLimitResult.allowed) {
        return Response.json({
          error: `Too many account registrations from this IP address in the past 24 hours. (Limit: ${rateLimitResult.limit}/24h)`
        }, { status: 429 });
      }

      // Parse payload
      let body: any = {};
      try {
        body = await request.clone().json();
      } catch {}

      const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
      const turnstileToken = body.turnstileToken || request.headers.get('CF-Turnstile-Response') || '';
      const powChallenge = body.powChallenge;
      const powNonce = body.powNonce;

      // 2. Verify Cloudflare Turnstile Token
      const turnstileRes = await verifyTurnstileToken(turnstileToken, clientIp, env);
      if (!turnstileRes.success) {
        return Response.json({ error: `Security check failed: ${turnstileRes.error}` }, { status: 400 });
      }

      // 3. Verify Proof-of-Work solution
      if (!powChallenge || !powNonce) {
        return Response.json({ error: 'Proof-of-Work challenge and nonce are required for account creation.' }, { status: 400 });
      }

      const powRes = await verifyPoWSolution(powChallenge, powNonce, 4);
      if (!powRes.valid) {
        return Response.json({ error: `Anti-bot check failed: ${powRes.error}` }, { status: 400 });
      }

      // 4. Prevent PoW nonce replay — mark this challenge as consumed in D1
      const encoder = new TextEncoder();
      const nonceInput = `${powChallenge}:${powNonce}`;
      const nonceHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(nonceInput));
      const nonceHash = Array.from(new Uint8Array(nonceHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      const challengeExpiresAt = Date.now() + 5 * 60 * 1000; // PoW max age is 5 minutes

      const isFirstUse = await d1.markPoWNonceUsed(nonceHash, challengeExpiresAt);
      if (!isFirstUse) {
        return Response.json({ error: 'Proof-of-Work solution has already been used. Please reload and try again.' }, { status: 400 });
      }
    }

    const userId = auth ? auth.user.id : `user_${crypto.randomUUID().replace(/-/g, '')}`;
    const user = await d1.getOrCreateUser(userId);
    const userDevices = await d1.getDevicesByUser(user.id);

    if (userDevices.length >= 3) {
      return Response.json({
        error: 'Device limit reached. You can connect up to 3 trusted devices per account. Please revoke an existing device to register a new one.'
      }, { status: 400 });
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: url.hostname,
      userID: new TextEncoder().encode(user.id),
      userName: `nook_${user.id.slice(0, 8)}`,
      userDisplayName: 'Nook Vault Owner',
      attestationType: 'none',
      excludeCredentials: userDevices.map(d => ({
        id: d.credential_id,
        transports: d.transports ? (d.transports.split(',') as any) : undefined,
      })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });

    return Response.json({ options, userId: user.id, userSalt: user.user_salt });
  }

  // ─── 3. POST /api/auth/register-passkey/verify — Complete passkey registration ───
  if (path === '/api/auth/register-passkey/verify' && request.method === 'POST') {
    try {
      const { registrationResponse, deviceName, userId, expectedChallenge } = await request.json() as any;
      const targetUserId = userId || `user_${crypto.randomUUID().replace(/-/g, '')}`;
      const user = await d1.getOrCreateUser(targetUserId);

      const existingDevices = await d1.getDevicesByUser(user.id);
      if (existingDevices.length >= 3) {
        return Response.json({
          error: 'Device limit reached. Maximum 3 trusted devices allowed per vault.'
        }, { status: 400 });
      }

      const verification = await verifyRegistrationResponse({
        response: registrationResponse, expectedChallenge,
        expectedOrigin: url.origin, expectedRPID: url.hostname,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return Response.json({ error: 'Passkey verification failed' }, { status: 400 });
      }

      const { credential } = verification.registrationInfo;
      const publicKeyBase64 = arrayBufferToBase64Url(credential.publicKey);

      const device = await d1.createDevice({
        id: crypto.randomUUID(), user_id: user.id,
        name: deviceName || 'Passkey Device',
        credential_id: credential.id, public_key: publicKeyBase64,
        counter: credential.counter,
      });

      await d1.createAuditLog({
        user_id: user.id, device_id: device.id, event_type: 'DEVICE_REGISTERED',
        ip_address: request.headers.get('CF-Connecting-IP') || '',
        user_agent: request.headers.get('User-Agent') || '',
        details: `Registered passkey: ${device.name}`,
      });

      // Auto-create session after registration
      const { session, rawSessionToken } = await createUserSession(d1, user.id, device.id, device.name, request);

      const response = Response.json({
        success: true, device,
        user: { id: user.id, userSalt: user.user_salt || user.id, storageUsedBytes: user.storage_used_bytes, storageQuotaBytes: user.storage_quota_bytes },
        sessionId: session.id,
      });
      response.headers.set('Set-Cookie', createSessionCookie(rawSessionToken));
      return response;
    } catch (err: any) {
      return Response.json({ error: err.message || 'Verification error' }, { status: 400 });
    }
  }

  // ─── 4. POST /api/auth/login-passkey/options — Start passkey authentication (returning user) ───
  if (path === '/api/auth/login-passkey/options' && request.method === 'POST') {
    if (!(await checkUnlockRateLimitD1(env.DB, request))) {
      return Response.json({ error: 'Too many unlock/authentication attempts from this IP address. Blocked for 15 minutes.' }, { status: 429 });
    }
    try {
      const options = await generateAuthenticationOptions({
        rpID: url.hostname,
        userVerification: 'preferred',
        // Empty allowCredentials = discoverable credential (resident key)
      });
      return Response.json({ options });
    } catch (err: any) {
      return Response.json({ error: err.message || 'Failed to generate authentication options' }, { status: 400 });
    }
  }

  // ─── 5. POST /api/auth/login-passkey/verify — Complete passkey authentication ───
  if (path === '/api/auth/login-passkey/verify' && request.method === 'POST') {
    if (!(await checkUnlockRateLimitD1(env.DB, request))) {
      return Response.json({ error: 'Too many unlock/authentication attempts from this IP address. Blocked for 15 minutes.' }, { status: 429 });
    }
    try {
      const { authenticationResponse, expectedChallenge } = await request.json() as any;

      // Look up the credential in our database
      const credentialId = authenticationResponse.id;
      const device = await d1.getDeviceByCredentialId(credentialId);
      if (!device) {
        return Response.json({ error: 'This passkey is not registered with any Nook vault. Please create a new vault first.' }, { status: 404 });
      }

      const user = await d1.getUserById(device.user_id);
      if (!user) {
        return Response.json({ error: 'Account not found for this passkey.' }, { status: 404 });
      }

      const publicKeyBytes = base64UrlToArrayBuffer(device.public_key);

      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse, expectedChallenge,
        expectedOrigin: url.origin, expectedRPID: url.hostname,
        credential: {
          id: device.credential_id,
          publicKey: publicKeyBytes as any,
          counter: device.counter,
        },
      });

      if (!verification.verified) {
        return Response.json({ error: 'Passkey authentication failed.' }, { status: 401 });
      }

      // Update counter
      await d1.updateDeviceCounter(device.id, verification.authenticationInfo.newCounter);

      // Create session
      const { session, rawSessionToken } = await createUserSession(d1, user.id, device.id, device.name, request);

      const response = Response.json({
        success: true,
        user: { id: user.id, userSalt: user.user_salt || user.id, storageUsedBytes: user.storage_used_bytes, storageQuotaBytes: user.storage_quota_bytes },
        sessionId: session.id,
      });
      response.headers.set('Set-Cookie', createSessionCookie(rawSessionToken));
      return response;
    } catch (err: any) {
      return Response.json({ error: err.message || 'Passkey authentication error' }, { status: 400 });
    }
  }

  // ─── 6. POST /api/auth/logout ───
  if (path === '/api/auth/logout' && request.method === 'POST') {
    const auth = await authenticateRequest(request, env);
    if (auth) {
      await d1.revokeSession(auth.session.id, auth.user.id);
      await d1.createAuditLog({
        user_id: auth.user.id, device_id: auth.session.device_id,
        event_type: 'SESSION_REVOKED',
        ip_address: request.headers.get('CF-Connecting-IP') || '',
        user_agent: request.headers.get('User-Agent') || '', details: 'User logged out',
      });
    }
    const response = Response.json({ success: true });
    response.headers.set('Set-Cookie', clearSessionCookie());
    return response;
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
