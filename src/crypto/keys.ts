/**
 * Nook Zero-Knowledge Cryptographic Key Engine
 * "Your device is the key." — Passphrase is for encryption only, never identity.
 */

// Convert ArrayBuffer / Uint8Array to Base64URL
export function arrayBufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convert Base64URL to Uint8Array
export function base64UrlToArrayBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Generate Cryptographically Secure Random Bytes
export function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

import { deriveArgon2idKey } from './argon2Worker';

// Derive Vault Master Key (VMK) from user passphrase + salt using Argon2id Web Worker (m=25 MiB, t=3, p=1)
export async function deriveVaultMasterKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyBytes = await deriveArgon2idKey(passphrase, salt);
  return importRawKey(keyBytes);
}

// Export raw key bytes
export async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

// Import raw 256-bit key bytes back into CryptoKey
export async function importRawKey(keyBytes: Uint8Array, usages: KeyUsage[] = ['encrypt', 'decrypt']): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'AES-GCM', length: 256 }, true, usages);
}

// HKDF Subkey expansion
export async function deriveSubkey(masterKeyRaw: Uint8Array, infoString: string, salt: Uint8Array): Promise<CryptoKey> {
  const hkdfKey = await crypto.subtle.importKey('raw', masterKeyRaw as BufferSource, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: new TextEncoder().encode(infoString) as BufferSource },
    hkdfKey, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
}

// Derive domain-isolated Metadata Key & File Wrapping Key from VMK
// Uses myvault_* strings for backward compatibility with pre-existing encrypted files
export async function deriveDomainSubkeys(vmk: CryptoKey): Promise<{ metadataKey: CryptoKey; fileWrappingKey: CryptoKey }> {
  const vmkRaw = await exportRawKey(vmk);
  const encoder = new TextEncoder();
  const metadataKey = await deriveSubkey(vmkRaw, 'myvault-metadata', encoder.encode('myvault_metadata_salt'));
  const fileWrappingKey = await deriveSubkey(vmkRaw, 'myvault-file-wrapping', encoder.encode('myvault_file_wrapping_salt'));
  return { metadataKey, fileWrappingKey };
}

// Generate fresh 256-bit random File Key (FK)
export async function generateFileKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

// Encrypt per-file File Key (FK) using File Wrapping Key (FWK)
export async function wrapFileKey(fileKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const rawFileKey = await exportRawKey(fileKey);
  const iv = getRandomBytes(12);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, wrappingKey, rawFileKey as BufferSource);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return arrayBufferToBase64Url(combined);
}

// Decrypt per-file File Key (FK) using File Wrapping Key (FWK)
export async function unwrapFileKey(encryptedEnvelopeBase64: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const combined = base64UrlToArrayBuffer(encryptedEnvelopeBase64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, wrappingKey, ciphertext as BufferSource);
  return importRawKey(new Uint8Array(decrypted));
}

// ─── Passphrase Strength Meter ───
export function measurePassphraseStrength(passphrase: string): { score: number; label: string; color: string } {
  let score = 0;
  if (passphrase.length >= 8) score++;
  if (passphrase.length >= 12) score++;
  if (passphrase.length >= 20) score++;
  if (/[a-z]/.test(passphrase) && /[A-Z]/.test(passphrase)) score++;
  if (/\d/.test(passphrase)) score++;
  if (/[^a-zA-Z0-9]/.test(passphrase)) score++;
  // Penalize common patterns
  if (/^(\d)\1+$/.test(passphrase) || /^(012|123|234|345|456|567|678|789|abc|password|qwerty)/i.test(passphrase)) {
    score = Math.max(0, score - 3);
  }

  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f59e0b' };
  if (score <= 4) return { score, label: 'Good', color: '#22c55e' };
  return { score, label: 'Strong', color: '#06b6d4' };
}
