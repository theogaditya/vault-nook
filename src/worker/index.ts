/**
 * Nook Cloudflare Worker Entrypoint — with CORS validation and sanitized errors
 */

import { Env, AuthenticatedRequest } from './types';
import { addSecurityHeaders } from './middleware/security';
import { handleAuthRoutes } from './routes/auth';
import { handleAccountRoutes } from './routes/account';
import { handleDeviceRoutes } from './routes/devices';
import { handleSessionRoutes } from './routes/sessions';
import { handleFolderRoutes } from './routes/folders';
import { handleFileRoutes } from './routes/files';
import { handleUploadAndDownloadRoutes } from './routes/uploads';
import { handleAuditRoutes } from './routes/audit';
import { handleRecoveryRoutes } from './routes/recovery';

const ALLOWED_ORIGINS = [
  'https://vault.adityahota99.workers.dev',
  'http://localhost:5173',
  'http://localhost:8787',
];

function getCorsOrigin(request: Request): string {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return url.origin; // Same-origin fallback
}

function sanitizeError(msg: string): string {
  if (msg.includes('D1_ERROR') || msg.includes('SQLITE_ERROR') || msg.includes('no column named')) {
    return 'Database schema update required. Please run pending D1 migrations.';
  }
  // Strip internal stack traces
  if (msg.includes('\n')) return msg.split('\n')[0];
  return msg;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsOrigin = getCorsOrigin(request);

    if (request.method === 'OPTIONS') {
      return addSecurityHeaders(
        new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
            'Access-Control-Allow-Credentials': 'true',
          },
        })
      );
    }

    if (path.startsWith('/api/')) {
      let response: Response;
      const req = request as AuthenticatedRequest;

      try {
        if (path.startsWith('/api/auth')) {
          response = await handleAuthRoutes(req, env, url);
        } else if (path.startsWith('/api/account')) {
          response = await handleAccountRoutes(req, env, url);
        } else if (path.startsWith('/api/devices')) {
          response = await handleDeviceRoutes(req, env, url);
        } else if (path.startsWith('/api/sessions')) {
          response = await handleSessionRoutes(req, env, url);
        } else if (path.startsWith('/api/folders')) {
          response = await handleFolderRoutes(req, env, url);
        } else if (path.startsWith('/api/uploads') || (path.startsWith('/api/files/') && path.includes('/chunk/'))) {
          response = await handleUploadAndDownloadRoutes(req, env, url);
        } else if (path.startsWith('/api/files')) {
          response = await handleFileRoutes(req, env, url);
        } else if (path.startsWith('/api/audit')) {
          response = await handleAuditRoutes(req, env, url);
        } else if (path.startsWith('/api/recovery')) {
          response = await handleRecoveryRoutes(req, env, url);
        } else {
          response = Response.json({ error: 'Endpoint not found' }, { status: 404 });
        }
      } catch (err: any) {
        const errorMsg = sanitizeError(err?.message || 'Internal Server Error');
        response = Response.json({ error: errorMsg }, { status: 500 });
      }

      return addSecurityHeaders(response);
    }

    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return addSecurityHeaders(assetResponse);
      const indexResponse = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
      return addSecurityHeaders(indexResponse);
    } catch {
      return addSecurityHeaders(new Response('Nook Worker API Running', { status: 200 }));
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const { D1Service } = await import('./services/d1');
    const d1 = new D1Service(env.DB);
    ctx.waitUntil(
      Promise.all([
        d1.reconcileExpiredUploads(),
        d1.cleanupExpiredSecurityRecords(),
      ])
    );
  },
};
