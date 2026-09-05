/**
 * Nook Emergency Recovery Utility — Alphanumeric High-Entropy Key System
 */

import { getRandomBytes, deriveVaultMasterKey, exportRawKey, importRawKey, arrayBufferToBase64Url, base64UrlToArrayBuffer } from './keys';

const ALPHA_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class RecoveryManager {
  /** Normalizes recovery key/phrase input (strips spaces, hyphens, converts to uppercase) */
  static normalizeKey(input: string): string {
    const trimmed = input.trim();
    // Legacy support: if input contains spaces and looks like 24 words, normalize to lowercase space-separated words
    if (trimmed.includes(' ')) {
      return trimmed.toLowerCase().replace(/\s+/g, ' ');
    }
    // High-entropy alphanumeric code: strip hyphens/spaces, convert to uppercase
    return trimmed.replace(/[\s\-]/g, '').toUpperCase();
  }

  /** Generate 32-character formatted alphanumeric recovery key (8 blocks of 4) */
  static generateRecoveryPhrase(): { phrase: string; hash: string } {
    const bytes = getRandomBytes(32);
    let rawChars = '';
    for (let i = 0; i < 32; i++) {
      rawChars += ALPHA_CHARSET[bytes[i] % ALPHA_CHARSET.length];
    }

    // Format as 8 blocks of 4: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
    const blocks: string[] = [];
    for (let i = 0; i < 32; i += 4) {
      blocks.push(rawChars.slice(i, i + 4));
    }
    const phrase = blocks.join('-');
    const normalized = this.normalizeKey(phrase);

    const encoder = new TextEncoder();
    const phraseBytes = encoder.encode(normalized);
    const fingerprint = Array.from(phraseBytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join('');

    return { phrase, hash: fingerprint };
  }

  /** Encrypt Vault Master Key (VMK) using recovery key */
  static async createRecoveryEnvelope(
    vaultMasterKey: CryptoKey,
    recoveryPhrase: string
  ): Promise<{ recoveryKeyHash: string; encryptedVaultKey: string }> {
    const normalized = this.normalizeKey(recoveryPhrase);
    const salt = getRandomBytes(32);
    const recoveryKey = await deriveVaultMasterKey(normalized, salt);

    const vmkRaw = await exportRawKey(vaultMasterKey);
    const iv = getRandomBytes(12);
    const encryptedVmk = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource }, recoveryKey, vmkRaw as BufferSource
    );

    const combined = new Uint8Array(salt.length + iv.length + encryptedVmk.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedVmk), salt.length + iv.length);

    const encryptedVaultKeyStr = arrayBufferToBase64Url(combined);

    const encoder = new TextEncoder();
    const phraseHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(normalized) as BufferSource);
    const recoveryKeyHash = arrayBufferToBase64Url(new Uint8Array(phraseHashBuffer));

    return { recoveryKeyHash, encryptedVaultKey: encryptedVaultKeyStr };
  }

  /** Restore VMK from recovery key and encrypted envelope */
  static async decryptRecoveryEnvelope(encryptedVaultKeyStr: string, recoveryPhrase: string): Promise<CryptoKey> {
    const normalized = this.normalizeKey(recoveryPhrase);
    const combined = base64UrlToArrayBuffer(encryptedVaultKeyStr);
    const salt = combined.slice(0, 32);
    const iv = combined.slice(32, 44);
    const ciphertext = combined.slice(44);

    const recoveryKey = await deriveVaultMasterKey(normalized, salt);

    const vmkBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource }, recoveryKey, ciphertext as BufferSource
    );

    return importRawKey(new Uint8Array(vmkBuffer));
  }
}
