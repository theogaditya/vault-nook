/**
 * Security Audit Log Router Handlers
 */

import { Env, AuthenticatedRequest } from '../types';
import { D1Service } from '../services/d1';
import { authenticateRequest } from '../middleware/security';

export async function handleAuditRoutes(request: AuthenticatedRequest, env: Env, url: URL): Promise<Response> {
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const d1 = new D1Service(env.DB);
  const path = url.pathname;

  if (path === '/api/audit' && request.method === 'GET') {
    const logs = await d1.getAuditLogs(auth.user.id, 50);
    return Response.json({ logs });
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
