/**
 * Account Operations Router — Two-step deletion, Storage Quota
 */

import { Env, AuthenticatedRequest } from '../types';
import { D1Service } from '../services/d1';
import { R2Service } from '../services/r2';
import { authenticateRequest } from '../middleware/security';

export async function handleAccountRoutes(request: AuthenticatedRequest, env: Env, url: URL): Promise<Response> {
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const d1 = new D1Service(env.DB);
  const r2 = new R2Service(env.MYVAULT_BUCKET);
  const path = url.pathname;

  // 1. GET /api/account/me - Account info & quota usage
  if (path === '/api/account/me' && request.method === 'GET') {
    const user = await d1.getUserById(auth.user.id);
    if (!user) {
      return Response.json({ error: 'Account not found' }, { status: 404 });
    }

    return Response.json({
      user: {
        id: user.id,
        userSalt: user.user_salt,
        storageUsedBytes: user.storage_used_bytes,
        storageQuotaBytes: user.storage_quota_bytes,
        status: user.status,
        createdAt: user.created_at,
      },
    });
  }

  // 2. POST /api/account/delete-request — Step 1: issues a short-lived deletion confirmation token
  //    Requires active session. Client must send the token back in the DELETE body within 2 minutes.
  if (path === '/api/account/delete-request' && request.method === 'POST') {
    const token = await d1.createDeleteConfirmation(auth.user.id);

    await d1.createAuditLog({
      user_id: auth.user.id,
      device_id: auth.session.device_id,
      event_type: 'ACCOUNT_DELETE_REQUESTED',
      ip_address: request.headers.get('CF-Connecting-IP') || '',
      user_agent: request.headers.get('User-Agent') || '',
      details: 'Account deletion token issued (2-minute TTL)',
    });

    return Response.json({ token });
  }

  // 3. DELETE /api/account — Step 2: requires valid confirmation token from step 1
  if (path === '/api/account' && request.method === 'DELETE') {
    try {
      let confirmToken: string | null = null;
      try {
        const body = await request.json() as { confirmToken?: string };
        confirmToken = body.confirmToken || null;
      } catch {}

      if (!confirmToken) {
        return Response.json({ error: 'Deletion confirmation token is required. Please request one via POST /api/account/delete-request first.' }, { status: 400 });
      }

      const isValid = await d1.verifyAndConsumeDeleteConfirmation(confirmToken, auth.user.id);
      if (!isValid) {
        return Response.json({ error: 'Deletion confirmation token is invalid or expired. Please request a new one.' }, { status: 403 });
      }

      // 1. Audit Log before purge
      await d1.createAuditLog({
        user_id: auth.user.id,
        device_id: auth.session.device_id,
        event_type: 'ACCOUNT_DELETED',
        ip_address: request.headers.get('CF-Connecting-IP') || '',
        user_agent: request.headers.get('User-Agent') || '',
        details: `Account deletion confirmed and executed for user ${auth.user.id}`,
      });

      // 2. Cascade delete all user D1 metadata and retrieve R2 object IDs
      const objectIds = await d1.deleteUserAccount(auth.user.id);

      // 3. Delete encrypted objects from R2 bucket
      for (const objId of objectIds) {
        await r2.deleteObjectChunks(objId);
      }

      // 4. Clear auth session cookie
      const headers = new Headers();
      headers.set('Set-Cookie', 'nook_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');

      return new Response(JSON.stringify({ success: true, message: 'Account deleted completely.' }), {
        status: 200,
        headers,
      });
    } catch (err: any) {
      return Response.json({ error: err.message || 'Failed to delete account' }, { status: 500 });
    }
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
