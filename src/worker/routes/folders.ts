/**
 * Folder CRUD Router — with cascade deletion
 */

import { Env, AuthenticatedRequest } from '../types';
import { D1Service } from '../services/d1';
import { R2Service } from '../services/r2';
import { authenticateRequest } from '../middleware/security';

export async function handleFolderRoutes(request: AuthenticatedRequest, env: Env, url: URL): Promise<Response> {
  const auth = await authenticateRequest(request, env);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const d1 = new D1Service(env.DB);
  const r2 = new R2Service(env.MYVAULT_BUCKET);
  const path = url.pathname;

  if (path === '/api/folders' && request.method === 'GET') {
    const hasParentFilter = url.searchParams.has('parentId');
    const parentIdParam = url.searchParams.get('parentId');
    const parentId = !hasParentFilter
      ? undefined
      : parentIdParam === '' || parentIdParam === 'null'
      ? null
      : parentIdParam;
    const folders = await d1.getFolders(auth.user.id, parentId);
    return Response.json({ folders });
  }

  if (path === '/api/folders' && request.method === 'POST') {
    try {
      const body = await request.json() as { parent_id?: string | null; encrypted_name: string };
      if (!body.encrypted_name) return Response.json({ error: 'Encrypted folder name is required' }, { status: 400 });
      const folder = await d1.createFolder({
        id: crypto.randomUUID(), user_id: auth.user.id,
        parent_id: body.parent_id || null, encrypted_name: body.encrypted_name,
      });
      return Response.json({ folder });
    } catch (err: any) {
      return Response.json({ error: err.message || 'Failed to create folder' }, { status: 400 });
    }
  }

  if (path.startsWith('/api/folders/') && request.method === 'PATCH') {
    const folderId = path.split('/')[3];
    if (!folderId) return Response.json({ error: 'Missing folder ID' }, { status: 400 });
    try {
      const body = await request.json() as { encrypted_name?: string; parent_id?: string | null };
      await d1.updateFolder(folderId, auth.user.id, body);
      return Response.json({ success: true });
    } catch (err: any) {
      return Response.json({ error: err.message || 'Failed to update folder' }, { status: 400 });
    }
  }

  if (path.startsWith('/api/folders/') && request.method === 'DELETE') {
    const folderId = path.split('/')[3];
    if (!folderId) return Response.json({ error: 'Missing folder ID' }, { status: 400 });

    // Cascade delete folder + children + files; clean up R2
    const orphanedObjectIds = await d1.deleteFolder(folderId, auth.user.id);
    for (const objId of orphanedObjectIds) {
      try { await r2.deleteObjectChunks(objId); } catch {}
    }

    await d1.createAuditLog({
      user_id: auth.user.id, device_id: auth.session.device_id,
      event_type: 'FOLDER_DELETED', ip_address: request.headers.get('CF-Connecting-IP') || '',
      user_agent: request.headers.get('User-Agent') || '',
      details: `Deleted folder ${folderId} (${orphanedObjectIds.length} files purged)`,
    });

    return Response.json({ success: true });
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
