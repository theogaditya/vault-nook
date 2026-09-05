/**
 * Argon2id Key Derivation Worker Client
 * Spawns and manages Web Worker for Argon2id derivation (m=25 MiB, t=3, p=1).
 * Prevents UI freezing during vault unlock and key derivation.
 */
import { argon2id } from 'hash-wasm';

let workerInstance: Worker | null = null;
const pendingRequests = new Map<string, { resolve: (val: Uint8Array) => void; reject: (err: Error) => void }>();

function getWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL('./argon2.worker.ts', import.meta.url), { type: 'module' });
      workerInstance.onmessage = (e: MessageEvent<{ id: string; success: boolean; keyBytes?: Uint8Array; error?: string }>) => {
        const { id, success, keyBytes, error } = e.data;
        const pending = pendingRequests.get(id);
        if (pending) {
          pendingRequests.delete(id);
          if (success && keyBytes) {
            pending.resolve(keyBytes);
          } else {
            pending.reject(new Error(error || 'Argon2id derivation failed in Web Worker'));
          }
        }
      };
      workerInstance.onerror = (err) => {
        console.error('Argon2id Worker error:', err);
      };
    } catch (e) {
      console.warn('Web Worker creation failed, using main-thread fallback:', e);
      workerInstance = null;
    }
  }
  return workerInstance;
}

/**
 * Derive 32-byte key using Argon2id with m=25 MiB (25600 KiB), t=3, p=1
 */
export async function deriveArgon2idKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const worker = getWorker();
  const id = Math.random().toString(36).substring(2) + Date.now().toString(36);

  if (worker) {
    return new Promise<Uint8Array>((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      worker.postMessage({ id, passphrase, salt });
    });
  }

  // Fallback for environments where Web Workers aren't available
  return argon2id({
    password: passphrase,
    salt: salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 25600,
    hashLength: 32,
    outputType: 'binary',
  });
}
