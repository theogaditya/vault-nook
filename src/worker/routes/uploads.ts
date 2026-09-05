/**
 * Chunked Upload & Download Router — with expiry enforcement and chunk size validation
 */

import { Env, AuthenticatedRequest } from '../types';
import { D1Service } from '../services/d1';
import { R2Service } from '../services/r2';
import { authenticateRequest } from '../middleware/security';

const MAX_FILE_SIZE = 524288000; // 500 MB
const MAX_CHUNK_PAYLOAD = 6 * 1024 * 1024; // 6 MB (5 MB chunk + encryption overhead)
const PLAINTEXT_CHUNK_SIZE = 5 * 1024 * 1024;
const ENCRYPTED_CHUNK_OVERHEAD = 28; // 12-byte IV + 16-byte GCM tag

function getExpectedTotalChunks(plaintextSize: number): number {
  return Math.max(1, Math.ceil(plaintextSize / PLAINTEXT_CHUNK_SIZE));
}

function getExpectedStoredBytes(plaintextSize: number): number {
  return plaintextSize + getExpectedTotalChunks(plaintextSize) * ENCRYPTED_CHUNK_OVERHEAD;
}

function getExpectedEncryptedChunkBytes(plaintextSize: number, chunkIndex: number): number {
  const chunkStart = chunkIndex * PLAINTEXT_CHUNK_SIZE;
  const chunkEnd = Math.min(plaintextSize, chunkStart + PLAINTEXT_CHUNK_SIZE);
  const chunkPlaintextBytes = Math.max(0, chunkEnd - chunkStart);
  return chunkPlaintextBytes + ENCRYPTED_CHUNK_OVERHEAD;
}

export async function handleUploadAndDownloadRoutes(request: AuthenticatedRequest, env: Env, url: URL): Promise<Response> {
  const auth = await authenticateRequest(request, env);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const d1 = new D1Service(env.DB);
  const r2 = new R2Service(env.MYVAULT_BUCKET);
  const path = url.pathname;

  // 1. POST /api/uploads/init
  if (path === '/api/uploads/init' && request.method === 'POST') {
    try {
      const body = await request.json() as {
        folder_id?: string | null; total_chunks: number;
        encrypted_name: string; encrypted_metadata: string;
        encrypted_file_key: string; size: number; mime_type?: string;
      };

      if (!body.encrypted_name || !body.encrypted_metadata || !body.encrypted_file_key || !body.total_chunks || typeof body.size !== 'number') {
        return Response.json({ error: 'Missing required upload parameters' }, { status: 400 });
      }

      if (!Number.isSafeInteger(body.size) || body.size < 0) {
        return Response.json({ error: 'Invalid file size for upload initialization.' }, { status: 400 });
      }

      if (body.size > MAX_FILE_SIZE) {
        return Response.json({ error: 'File size exceeds maximum upload limit of 500 MB.' }, { status: 413 });
      }

      const expectedTotalChunks = getExpectedTotalChunks(body.size);
      if (body.total_chunks !== expectedTotalChunks) {
        return Response.json({ error: `Invalid chunk manifest. Expected ${expectedTotalChunks} chunks for this file size.` }, { status: 400 });
      }

      const expectedStoredBytes = getExpectedStoredBytes(body.size);

      const userRecord = await d1.getUserById(auth.user.id);
      const usedBytes = userRecord?.storage_used_bytes || 0;
      const defaultQuota = auth.user.id === 'user_ae71159c13ca4ba78b0b24ccd827a5b3' ? 2147483648 : 524288000;
      const quotaBytes = userRecord?.storage_quota_bytes || defaultQuota;

      if (usedBytes + expectedStoredBytes > quotaBytes) {
        return Response.json({
          error: `Storage quota exceeded. This upload needs ${Math.round(expectedStoredBytes / 1024 / 1024)} MB of encrypted storage.`,
        }, { status: 413 });
      }

      const fileId = crypto.randomUUID();
      const objectId = crypto.randomUUID();
      const uploadId = crypto.randomUUID();

      const file = await d1.createFile({
        id: fileId, user_id: auth.user.id, folder_id: body.folder_id || null,
        object_id: objectId, encrypted_name: body.encrypted_name,
        encrypted_metadata: body.encrypted_metadata, encrypted_file_key: body.encrypted_file_key,
        size: expectedStoredBytes, mime_type: body.mime_type || 'application/octet-stream',
      });

      const uploadSession = await d1.createUploadSession({
        id: uploadId, user_id: auth.user.id, file_id: fileId,
        object_id: objectId, total_chunks: body.total_chunks,
        expires_at: Date.now() + 2 * 60 * 60 * 1000,
      });

      // Opportunistically clean up any expired/abandoned uploads in the background
      d1.reconcileExpiredUploads().catch(() => {});

      return Response.json({ uploadId: uploadSession.id, fileId: file.id, objectId: file.object_id });
    } catch (err: any) {
      return Response.json({ error: err.message || 'Failed to initialize upload' }, { status: 400 });
    }
  }

  // 2. PUT /api/uploads/:uploadId/chunk/:chunkIndex
  if (path.startsWith('/api/uploads/') && path.includes('/chunk/') && request.method === 'PUT') {
    const parts = path.split('/');
    const uploadId = parts[3];
    const chunkIndex = parseInt(parts[5], 10);

    if (!uploadId || isNaN(chunkIndex)) {
      return Response.json({ error: 'Invalid upload chunk request parameters' }, { status: 400 });
    }

    const session = await d1.getUploadSession(uploadId, auth.user.id);
    if (!session) {
      return Response.json({ error: 'Upload session not found or expired. Please restart the upload.' }, { status: 404 });
    }

    if (!request.body) {
      return Response.json({ error: 'Missing chunk ciphertext payload' }, { status: 400 });
    }

    // Validate chunk index bounds
    if (chunkIndex < 0 || chunkIndex >= session.total_chunks) {
      return Response.json({ error: `Chunk index ${chunkIndex} out of bounds (total: ${session.total_chunks})` }, { status: 400 });
    }

    const file = await d1.getFileById(session.file_id, auth.user.id);
    if (!file) {
      return Response.json({ error: 'Upload file record not found' }, { status: 404 });
    }

    const declaredPlaintextBytes = file.size - session.total_chunks * ENCRYPTED_CHUNK_OVERHEAD;
    if (declaredPlaintextBytes < 0) {
      return Response.json({ error: 'Corrupt upload manifest detected' }, { status: 400 });
    }

    const expectedChunkBytes = getExpectedEncryptedChunkBytes(declaredPlaintextBytes, chunkIndex);
    if (expectedChunkBytes > MAX_CHUNK_PAYLOAD) {
      return Response.json({ error: 'Chunk exceeds allowed encrypted payload limit' }, { status: 413 });
    }

    const payloadBuffer = await request.arrayBuffer();
    const payload = new Uint8Array(payloadBuffer);
    if (payload.byteLength !== expectedChunkBytes) {
      return Response.json({
        error: `Chunk size mismatch. Expected ${expectedChunkBytes} encrypted bytes, received ${payload.byteLength}.`,
      }, { status: 400 });
    }

    await r2.putChunk(session.object_id, chunkIndex, payload);
    await d1.incrementUploadChunk(uploadId);

    return Response.json({ success: true, chunkIndex });
  }

  // 3. POST /api/uploads/:uploadId/complete
  if (path.startsWith('/api/uploads/') && path.endsWith('/complete') && request.method === 'POST') {
    const parts = path.split('/');
    const uploadId = parts[3];

    const session = await d1.getUploadSession(uploadId, auth.user.id);
    if (!session) return Response.json({ error: 'Upload session not found' }, { status: 404 });

    const chunkStats = await r2.getObjectChunkStats(session.object_id);
    if (chunkStats.count !== session.total_chunks) {
      return Response.json({
        error: `Upload incomplete. Expected ${session.total_chunks} unique chunks, found ${chunkStats.count}.`,
      }, { status: 400 });
    }

    await d1.completeUploadSession(uploadId);

    await d1.createAuditLog({
      user_id: auth.user.id, device_id: auth.session.device_id,
      event_type: 'FILE_UPLOADED', ip_address: request.headers.get('CF-Connecting-IP') || '',
      user_agent: request.headers.get('User-Agent') || '',
      details: `Completed upload for file ${session.file_id} (${session.total_chunks} chunks, ${chunkStats.totalBytes} encrypted bytes)`,
    });

    return Response.json({ success: true, fileId: session.file_id });
  }

  // 4. GET /api/files/:id/chunk/:chunkIndex — Download
  if (path.startsWith('/api/files/') && path.includes('/chunk/') && request.method === 'GET') {
    const parts = path.split('/');
    const fileId = parts[3];
    const chunkIndex = parseInt(parts[5], 10);

    if (!fileId || isNaN(chunkIndex)) {
      return Response.json({ error: 'Invalid download chunk request parameters' }, { status: 400 });
    }

    const file = await d1.getFileById(fileId, auth.user.id);
    if (!file) return Response.json({ error: 'File not found or access denied' }, { status: 404 });

    const chunkObject = await r2.getChunk(file.object_id, chunkIndex);
    if (!chunkObject) return Response.json({ error: 'Chunk not found in storage' }, { status: 404 });

    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Cache-Control', 'private, no-cache, no-store');

    return new Response(chunkObject.body as any, { status: 200, headers });
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
