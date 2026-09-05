/**
 * Argon2id Key Derivation Web Worker
 * Executes memory-hard Argon2id (m=25 MiB, t=3, p=1) off the main UI thread.
 */
import { argon2id } from 'hash-wasm';

export interface Argon2WorkerInput {
  id: string;
  passphrase: string;
  salt: Uint8Array;
}

export interface Argon2WorkerOutput {
  id: string;
  success: boolean;
  keyBytes?: Uint8Array;
  error?: string;
}

self.onmessage = async (e: MessageEvent<Argon2WorkerInput>) => {
  const { id, passphrase, salt } = e.data;
  try {
    const keyBytes = await argon2id({
      password: passphrase,
      salt: salt,
      parallelism: 1,  // p=1
      iterations: 3,   // t=3
      memorySize: 25600, // m=25 MiB (25600 KiB)
      hashLength: 32,   // 256 bits output for AES-256-GCM key
      outputType: 'binary',
    });

    const response: Argon2WorkerOutput = { id, success: true, keyBytes };
    (self as any).postMessage(response, [keyBytes.buffer]);
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    (self as any).postMessage({ id, success: false, error: errorMsg } as Argon2WorkerOutput);
  }
};
