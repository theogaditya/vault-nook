/**
 * MyVault Cipher Engine
 * Handles AES-256-GCM chunked file encryption/decryption & JSON metadata envelope encryption.
 */

import { arrayBufferToBase64Url, base64UrlToArrayBuffer, getRandomBytes } from './keys';

export interface DecryptedFileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  checksum?: string;
  totalChunks: number;
  chunkSize: number;
  created: number;
}

// 5 MB chunk size
export const CHUNK_SIZE = 5 * 1024 * 1024;

/**
 * Encrypt a single binary file chunk using AES-256-GCM
 * Returns payload: [12-byte IV] [Ciphertext + 16-byte GCM Tag]
 */
export async function encryptChunk(
  fileKey: CryptoKey,
  chunkIndex: number,
  data: Uint8Array
): Promise<Uint8Array> {
  const iv = getRandomBytes(12);

  // Bind chunk index as additional authenticated data (AAD) to prevent chunk swapping attacks
  const encoder = new TextEncoder();
  const aad = encoder.encode(`chunk_${chunkIndex}`);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: aad as BufferSource,
    },
    fileKey,
    data as BufferSource
  );

  const result = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertextBuffer), iv.length);
  return result;
}

/**
 * Decrypt a single binary file chunk using AES-256-GCM
 * Throws error if authentication tag verification fails (tamper detection)
 */
export async function decryptChunk(
  fileKey: CryptoKey,
  chunkIndex: number,
  encryptedChunkPayload: Uint8Array
): Promise<Uint8Array> {
  if (encryptedChunkPayload.byteLength < 28) {
    throw new Error('Invalid encrypted chunk payload size');
  }

  const iv = encryptedChunkPayload.slice(0, 12);
  const ciphertext = encryptedChunkPayload.slice(12);

  const encoder = new TextEncoder();
  const aad = encoder.encode(`chunk_${chunkIndex}`);

  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: aad as BufferSource,
    },
    fileKey,
    ciphertext as BufferSource
  );

  return new Uint8Array(plaintextBuffer);
}

/**
 * Encrypt JSON metadata object using Metadata Key (MK)
 * Returns envelope string: "<iv_base64url>.<ciphertext_base64url>"
 */
export async function encryptMetadata(
  metadataKey: CryptoKey,
  metadata: Record<string, any>
): Promise<string> {
  const jsonString = JSON.stringify(metadata);
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(jsonString);

  const iv = getRandomBytes(12);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    metadataKey,
    plaintextBytes as BufferSource
  );

  const ivBase64 = arrayBufferToBase64Url(iv);
  const ciphertextBase64 = arrayBufferToBase64Url(new Uint8Array(ciphertextBuffer));

  return `${ivBase64}.${ciphertextBase64}`;
}

/**
 * Decrypt JSON metadata object using Metadata Key (MK)
 */
export async function decryptMetadata<T = Record<string, any>>(
  metadataKey: CryptoKey,
  envelope: string
): Promise<T> {
  const parts = envelope.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted metadata envelope format');
  }

  const iv = base64UrlToArrayBuffer(parts[0]);
  const ciphertext = base64UrlToArrayBuffer(parts[1]);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    metadataKey,
    ciphertext as BufferSource
  );

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(plaintextBuffer);
  return JSON.parse(jsonString) as T;
}

/**
 * Encrypt simple string (e.g. folder name or file name)
 */
export async function encryptString(
  key: CryptoKey,
  plaintext: string
): Promise<string> {
  return encryptMetadata(key, { v: plaintext });
}

/**
 * Decrypt simple string
 */
export async function decryptString(
  key: CryptoKey,
  envelope: string
): Promise<string> {
  const res = await decryptMetadata<{ v: string }>(key, envelope);
  return res.v;
}

/**
 * Compute SHA-256 hex checksum of ArrayBuffer
 */
export async function calculateChecksum(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
