/**
 * Session Management Router Handlers
 */

import { Env, AuthenticatedRequest } from '../types';
import { D1Service } from '../services/d1';
import { authenticateRequest } from '../middleware/security';

export async function handleSessionRoutes(request: AuthenticatedRequest, env: Env, url: URL): Promise<Response> {
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const d1 = new D1Service(env.DB);
  const path = url.pathname;

  // GET /api/sessions - List active sessions
  if (path === '/api/sessions' && request.method === 'GET') {
    const activeSessions = await d1.getActiveSessions(auth.user.id);
    const devices = await d1.getDevicesByUser(auth.user.id);
    const deviceMap = new Map(devices.map((d) => [d.id, d.name]));

    const sessionsWithDeviceNames = activeSessions.map((s) => ({
      ...s,
      isCurrent: s.id === auth.session.id,
      deviceName: deviceMap.get(s.device_id) || 'Passkey Authorized Device',
    }));

    return Response.json({
      sessions: sessionsWithDeviceNames,
      totalActiveCount: activeSessions.length,
      maxSessionLimit: 3,
    });
  }

  // DELETE /api/sessions/revoke-others - Revoke all other active sessions
  if (path === '/api/sessions/revoke-others' && request.method === 'DELETE') {
    const revokedCount = await d1.revokeAllOtherSessions(auth.user.id, auth.session.id);
    await d1.createAuditLog({
      user_id: auth.user.id,
      device_id: auth.session.device_id,
      event_type: 'SESSION_REVOKED',
      ip_address: request.headers.get('CF-Connecting-IP') || '',
      user_agent: request.headers.get('User-Agent') || '',
      details: `Revoked ${revokedCount} other active sessions`,
    });

    return Response.json({ success: true, revokedCount });
  }

  // DELETE /api/sessions/:id - Revoke single session
  if (path.startsWith('/api/sessions/') && request.method === 'DELETE') {
    const sessionId = path.split('/')[3];
    if (!sessionId) {
      return Response.json({ error: 'Missing session ID' }, { status: 400 });
    }

    await d1.revokeSession(sessionId, auth.user.id);
    await d1.createAuditLog({
      user_id: auth.user.id,
      device_id: auth.session.device_id,
      event_type: 'SESSION_REVOKED',
      ip_address: request.headers.get('CF-Connecting-IP') || '',
      user_agent: request.headers.get('User-Agent') || '',
      details: `Revoked session ID ${sessionId}`,
    });

    return Response.json({ success: true });
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
