/**
 * File Metadata & Operations Router — with safe R2 cleanup
 */

import { Env, AuthenticatedRequest } from '../types';
import { D1Service } from '../services/d1';
import { R2Service } from '../services/r2';
import { authenticateRequest } from '../middleware/security';

export async function handleFileRoutes(request: AuthenticatedRequest, env: Env, url: URL): Promise<Response> {
  const auth = await authenticateRequest(request, env);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const d1 = new D1Service(env.DB);
  const r2 = new R2Service(env.MYVAULT_BUCKET);
  const path = url.pathname;

  if (path === '/api/files' && request.method === 'GET') {
    const hasFolderFilter = url.searchParams.has('folderId');
    const folderIdParam = url.searchParams.get('folderId');
    const folderId = !hasFolderFilter
      ? undefined
      : folderIdParam === '' || folderIdParam === 'null'
      ? null
      : folderIdParam;
    const files = await d1.getFiles(auth.user.id, folderId);
    return Response.json({ files });
  }

  if (path.startsWith('/api/files/') && !path.includes('/chunk/') && request.method === 'GET') {
    const fileId = path.split('/')[3];
    const file = await d1.getFileById(fileId, auth.user.id);
    if (!file) return Response.json({ error: 'File not found' }, { status: 404 });
    return Response.json({ file });
  }

  if (path.startsWith('/api/files/') && request.method === 'PATCH') {
    const fileId = path.split('/')[3];
    try {
      const body = await request.json() as { encrypted_name?: string; folder_id?: string | null; encrypted_metadata?: string };
      await d1.updateFile(fileId, auth.user.id, body);
      await d1.createAuditLog({
        user_id: auth.user.id, device_id: auth.session.device_id,
        event_type: 'FILE_RENAMED', ip_address: request.headers.get('CF-Connecting-IP') || '',
        user_agent: request.headers.get('User-Agent') || '',
        details: `Updated metadata for file ${fileId}`,
      });
      return Response.json({ success: true });
    } catch (err: any) {
      return Response.json({ error: err.message || 'Failed to update file' }, { status: 400 });
    }
  }

  if (path.startsWith('/api/files/') && request.method === 'DELETE') {
    const fileId = path.split('/')[3];
    const file = await d1.deleteFile(fileId, auth.user.id);
    if (!file) return Response.json({ error: 'File not found' }, { status: 404 });

    // Best-effort R2 cleanup — don't fail the request if R2 delete errors
    try { await r2.deleteObjectChunks(file.object_id); } catch {}

    await d1.createAuditLog({
      user_id: auth.user.id, device_id: auth.session.device_id,
      event_type: 'FILE_DELETED', ip_address: request.headers.get('CF-Connecting-IP') || '',
      user_agent: request.headers.get('User-Agent') || '',
      details: `Deleted file ${fileId}`,
    });
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
