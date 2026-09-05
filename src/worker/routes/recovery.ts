/**
 * Vault Emergency Recovery Router — Rate-limited & cryptographic proof gated
 */

import { Env, AuthenticatedRequest } from '../types';
import { D1Service } from '../services/d1';
import { authenticateRequest, checkRateLimitD1, hashSessionToken, createSessionCookie, timingSafeEqual } from '../middleware/security';

export async function handleRecoveryRoutes(request: AuthenticatedRequest, env: Env, url: URL): Promise<Response> {
  // Rate-limit recovery routes via D1 (cross-instance): max 10 requests per 15 minutes per IP
  if (!(await checkRateLimitD1(env.DB, request, 'recovery', 10, 900))) {
    return Response.json({ error: 'Too many recovery attempts. Please try again in 15 minutes.' }, { status: 429 });
  }

  const d1 = new D1Service(env.DB);
  const path = url.pathname;

  // POST /api/recovery/setup - Store recovery material envelope (requires auth)
  if (path === '/api/recovery/setup' && request.method === 'POST') {
    const auth = await authenticateRequest(request, env);
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const body = await request.json() as { encryptedVaultKey: string; recoveryKeyHash: string };
      if (!body.encryptedVaultKey || !body.recoveryKeyHash) {
        return Response.json({ error: 'Missing recovery envelope fields' }, { status: 400 });
      }

      await d1.setRecoveryMaterial(auth.user.id, body.encryptedVaultKey, body.recoveryKeyHash);

      await d1.createAuditLog({
        user_id: auth.user.id, device_id: auth.session.device_id,
        event_type: 'RECOVERY_SETUP',
        ip_address: request.headers.get('CF-Connecting-IP') || '',
        user_agent: request.headers.get('User-Agent') || '',
        details: 'Generated emergency recovery kit envelope',
      });

      return Response.json({ success: true });
    } catch (err: any) {
      return Response.json({ error: err.message || 'Failed to setup recovery' }, { status: 400 });
    }
  }

  // GET /api/recovery/material - Fetch recovery envelope
  // Rate limited; requires valid session OR explicit vaultId param
  if (path === '/api/recovery/material' && request.method === 'GET') {
    const auth = await authenticateRequest(request, env);
    let userId: string | null = null;

    if (auth) {
      userId = auth.user.id;
    } else {
      const vaultId = url.searchParams.get('vaultId');
      if (!vaultId || vaultId.length < 10) {
        return Response.json({ error: 'Vault ID is required to retrieve recovery material without an active session.' }, { status: 401 });
      }
      const user = await d1.getUserById(vaultId);
      if (!user) {
        return Response.json({ error: 'No vault found with this ID.' }, { status: 404 });
      }
      userId = user.id;
    }

    const material = await d1.getRecoveryMaterial(userId);
    if (!material) {
      return Response.json({ error: 'No recovery kit has been configured for this vault.' }, { status: 404 });
    }
    return Response.json({ material: { encrypted_vault_key: material.encrypted_vault_key } });
  }

  // POST /api/recovery/authenticate - Mint session ONLY with valid recovery key hash proof
  if (path === '/api/recovery/authenticate' && request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({})) as { vaultId?: string; recoveryKeyHash?: string; deviceName?: string };
      if (!body.vaultId || !body.recoveryKeyHash) {
        return Response.json({ error: 'Vault ID and recovery proof are required.' }, { status: 400 });
      }

      const material = await d1.getRecoveryMaterial(body.vaultId);
      if (!material || !material.recovery_key_hash) {
        return Response.json({ error: 'No recovery kit configured for this vault.' }, { status: 404 });
      }

      // Timing-safe cryptographic verification of recovery key hash
      const hashesMatch = await timingSafeEqual(body.recoveryKeyHash, material.recovery_key_hash);
      if (!hashesMatch) {
        return Response.json({ error: 'Invalid recovery key proof.' }, { status: 401 });
      }

      const user = await d1.getUserById(body.vaultId);
      if (!user) return Response.json({ error: 'Vault not found.' }, { status: 404 });

      // Create device entry for emergency recovery session
      let devices = await d1.getDevicesByUser(user.id);
      let device = devices.find(d => d.public_key === 'recovery_auth');
      if (!device) {
        device = await d1.createDevice({
          id: crypto.randomUUID(), user_id: user.id,
          name: body.deviceName || 'Emergency Recovery Device',
          credential_id: `recovery_cred_${crypto.randomUUID()}`,
          public_key: 'recovery_auth', counter: 0,
        });
      }

      // Mint valid session
      await d1.revokeSessionsForDevice(user.id, device.id);
      const rawSessionToken = crypto.randomUUID() + crypto.randomUUID();
      const tokenHash = await hashSessionToken(rawSessionToken);
      const session = await d1.createSession({
        id: crypto.randomUUID(), user_id: user.id, device_id: device.id,
        token_hash: tokenHash, ip_address: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
        user_agent: request.headers.get('User-Agent') || 'Unknown', expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await d1.createAuditLog({
        user_id: user.id, device_id: device.id, event_type: 'RECOVERY_LOGIN',
        ip_address: request.headers.get('CF-Connecting-IP') || '',
        user_agent: request.headers.get('User-Agent') || '',
        details: 'Authenticated via emergency recovery key',
      });

      const response = Response.json({
        success: true,
        user: { id: user.id, userSalt: user.user_salt || user.id, storageUsedBytes: user.storage_used_bytes, storageQuotaBytes: user.storage_quota_bytes },
        sessionId: session.id,
      });
      response.headers.set('Set-Cookie', createSessionCookie(rawSessionToken));
      return response;
    } catch (err: any) {
      return Response.json({ error: err.message || 'Recovery authentication failed' }, { status: 400 });
    }
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
