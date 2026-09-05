/**
 * Device Management Router Handlers
 */

import { Env, AuthenticatedRequest } from '../types';
import { D1Service } from '../services/d1';
import { authenticateRequest } from '../middleware/security';

export async function handleDeviceRoutes(request: AuthenticatedRequest, env: Env, url: URL): Promise<Response> {
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const d1 = new D1Service(env.DB);
  const path = url.pathname;

  // GET /api/devices - List trusted passkeys, physical devices, and active logged-in sessions
  if (path === '/api/devices' && request.method === 'GET') {
    const sessions = await d1.getActiveSessions(auth.user.id);
    const userAgent = request.headers.get('User-Agent') || '';
    const ipAddress = request.headers.get('CF-Connecting-IP') || '127.0.0.1';

    // Ensure all current & past active sessions are registered as physical devices
    for (const s of sessions) {
      if (s.user_agent) {
        try {
          await d1.registerPhysicalDevice(auth.user.id, s.user_agent, s.ip_address || ipAddress);
        } catch {}
      }
    }
    if (userAgent) {
      try {
        await d1.registerPhysicalDevice(auth.user.id, userAgent, ipAddress);
      } catch {}
    }

    const devices = await d1.getDevicesByUser(auth.user.id);
    const physicalDevices = await d1.getPhysicalDevicesByUser(auth.user.id);

    return Response.json({
      devices,
      sessions,
      physicalDevices,
      currentSessionId: auth.session.id,
      currentDeviceId: auth.session.device_id,
    });
  }

  // DELETE /api/devices/:id - Revoke device, session, or physical device
  if (path.startsWith('/api/devices/') && request.method === 'DELETE') {
    const targetId = path.split('/')[3];
    if (!targetId) {
      return Response.json({ error: 'Missing device ID' }, { status: 400 });
    }

    await d1.revokeDevice(targetId, auth.user.id);
    await d1.revokeSession(targetId, auth.user.id);
    await d1.revokePhysicalDevice(targetId, auth.user.id);

    await d1.createAuditLog({
      user_id: auth.user.id,
      device_id: auth.session.device_id,
      event_type: 'DEVICE_REVOKED',
      ip_address: request.headers.get('CF-Connecting-IP') || '',
      user_agent: request.headers.get('User-Agent') || '',
      details: `Revoked device/session ID ${targetId}`,
    });

    return Response.json({ success: true });
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
