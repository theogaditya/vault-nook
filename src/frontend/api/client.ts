/**
 * Frontend API Client with Actionable Error Formatting & Global 401 Handling
 */

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string>),
    },
    credentials: 'same-origin',
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errJson = (await response.json()) as { error?: string };
      errorMsg = errJson.error || errorMsg;
    } catch {}

    // Global 401 Unauthorized handling — kick user out to login screen immediately
    if (response.status === 401 || errorMsg.toLowerCase() === 'unauthorized') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nook:unauthorized'));
      }
    }

    if (errorMsg.includes('D1_ERROR') || errorMsg.includes('SQLITE_ERROR') || errorMsg.includes('no column named')) {
      errorMsg = 'Database Schema Update Required: Please apply pending D1 migrations (`npx wrangler d1 migrations apply myvault-db`).';
    }

    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}
