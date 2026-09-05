/**
 * Nook Auth & Cryptographic State Hook
 * "Your device is the key." — Passkey for identity, passphrase for encryption.
 *
 * States:
 *   LOADING → UNAUTHENTICATED | AUTHENTICATED_LOCKED | AUTHENTICATED_UNLOCKED
 *   UNAUTHENTICATED → AUTHENTICATED_LOCKED (passkey auth)
 *   AUTHENTICATED_LOCKED → AUTHENTICATED_UNLOCKED (passphrase entered)
 */

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { deriveVaultMasterKey, deriveDomainSubkeys, exportRawKey, importRawKey, arrayBufferToBase64Url, base64UrlToArrayBuffer } from '../../crypto/keys';
import { RecoveryManager } from '../../crypto/recovery';
import { decryptString, encryptString, decryptMetadata } from '../../crypto/cipher';
import { apiRequest } from '../api/client';
import { PasskeyClient } from '../../crypto/webauthn';
import { solvePoWPuzzle } from '../../crypto/pow';

export interface CryptoKeys {
  vmk: CryptoKey;
  metadataKey: CryptoKey;
  fileWrappingKey: CryptoKey;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isUnlocked: boolean;
  isLoading: boolean;
  user: { id: string; userSalt?: string; storageUsedBytes?: number; storageQuotaBytes?: number; devicesCount?: number; hasRecovery?: boolean } | null;
  keys: CryptoKeys | null;
  // Auth actions
  createVaultWithPasskey: (deviceName?: string, turnstileToken?: string) => Promise<{ userId: string; userSalt: string }>;
  loginWithPasskey: () => Promise<void>;
  loginWithVaultId: (vaultId: string) => Promise<void>;
  unlockWithPassphrase: (passphrase: string) => Promise<void>;
  loginWithRecoveryPhrase: (vaultId: string, recoveryPhrase: string) => Promise<void>;
  registerAdditionalPasskey: (deviceName?: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (passphrase?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const VMK_STORAGE_KEY = 'nook_vmk_session';
const VMK_WRAP_KEY_STORAGE = 'nook_vmk_wk';

/**
 * Persist VMK to sessionStorage using a randomly-generated AES-GCM wrapping key.
 * The wrapping key itself is stored separately in sessionStorage.
 * This prevents the raw VMK bytes from sitting directly in storage;
 * an attacker stealing only one storage key cannot recover the VMK.
 */
async function persistVmkToSession(vmk: CryptoKey) {
  try {
    // Generate a fresh random AES-256-GCM wrapping key for this session
    const wrapKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const wrapKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', wrapKey));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const vmkRaw = new Uint8Array(await crypto.subtle.exportKey('raw', vmk));
    const encryptedVmk = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, wrapKey, vmkRaw as BufferSource);
    const combined = new Uint8Array(iv.length + encryptedVmk.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedVmk), iv.length);
    sessionStorage.setItem(VMK_STORAGE_KEY, arrayBufferToBase64Url(combined));
    sessionStorage.setItem(VMK_WRAP_KEY_STORAGE, arrayBufferToBase64Url(wrapKeyRaw));
  } catch {}
}

// Restore VMK from sessionStorage
async function restoreVmkFromSession(): Promise<CryptoKeys | null> {
  try {
    const storedEncrypted = sessionStorage.getItem(VMK_STORAGE_KEY);
    const storedWrapKeyRaw = sessionStorage.getItem(VMK_WRAP_KEY_STORAGE);
    if (!storedEncrypted || !storedWrapKeyRaw) return null;
    // .slice() creates a proper ArrayBuffer (not SharedArrayBuffer) required by SubtleCrypto
    const wrapKeyBytes = base64UrlToArrayBuffer(storedWrapKeyRaw).slice(0);
    const wrapKey = await crypto.subtle.importKey('raw', wrapKeyBytes, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const combinedBytes = base64UrlToArrayBuffer(storedEncrypted).slice(0);
    const iv = combinedBytes.slice(0, 12);
    const ciphertext = combinedBytes.slice(12);
    const vmkRaw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrapKey, ciphertext);
    const vmk = await importRawKey(new Uint8Array(vmkRaw));
    const { metadataKey, fileWrappingKey } = await deriveDomainSubkeys(vmk);
    return { vmk, metadataKey, fileWrappingKey };
  } catch { return null; }
}

function clearVmkSession() {
  try {
    sessionStorage.removeItem(VMK_STORAGE_KEY);
    sessionStorage.removeItem(VMK_WRAP_KEY_STORAGE);
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [keys, setKeys] = useState<CryptoKeys | null>(null);

  // Check session on load + try restoring VMK from sessionStorage
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await apiRequest('/api/auth/me');
        if (res.authenticated) {
          setIsAuthenticated(true);
          setUser(res.user);

          // Try restoring encryption keys from sessionStorage
          const restored = await restoreVmkFromSession();
          if (restored) {
            setKeys(restored);
            setIsUnlocked(true);
          }
        } else {
          setIsAuthenticated(false);
          setIsUnlocked(false);
          setKeys(null);
          setUser(null);
          clearVmkSession();
        }
      } catch {
        setIsAuthenticated(false);
        setIsUnlocked(false);
        setKeys(null);
        setUser(null);
        clearVmkSession();
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Listen for 401 Unauthorized events from any API call
  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setIsUnlocked(false);
      setKeys(null);
      setUser(null);
      clearVmkSession();
    };

    window.addEventListener('nook:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('nook:unauthorized', handleUnauthorized);
  }, []);

  // ── Lock vault on page unload / navigation (not tab switch) ──
  // This ensures users must re-enter their passphrase after a page reload or browser back/forward.
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear the in-session VMK so the unlock screen shows on next load
      clearVmkSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── 30-minute inactivity lock ──
  // Resets on mouse move, key press, or touch. After 30 min of inactivity the vault
  // is locked (keys wiped) and the user must re-enter their passphrase.
  const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes
  useEffect(() => {
    if (!isUnlocked) return; // Only track inactivity when vault is open

    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Lock vault — clear keys from memory and sessionStorage
        setIsUnlocked(false);
        setKeys(null);
        clearVmkSession();
      }, INACTIVITY_MS);
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'pointerdown', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer(); // Start the timer immediately

    return () => {
      clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [isUnlocked]); // Re-register whenever lock state changes

  // Refresh user data (e.g. after upload to update quota)
  const refreshUser = async () => {
    try {
      const res = await apiRequest('/api/auth/me');
      if (res.authenticated) setUser(res.user);
    } catch {}
  };

  // ── Create new vault with passkey ──
  const createVaultWithPasskey = async (deviceName?: string, turnstileToken?: string) => {
    setIsLoading(true);
    try {
      // Step 1a: Fetch Proof-of-Work challenge
      const powChallengeData = await apiRequest('/api/auth/pow-challenge');

      // Step 1b: Solve Proof-of-Work puzzle (~200ms - 1s CPU)
      const powSolution = await solvePoWPuzzle(powChallengeData.challenge, powChallengeData.difficulty);

      // Step 1c: Get registration options from server with Turnstile token + PoW solution
      const optionsRes = await apiRequest('/api/auth/register-passkey/options', {
        method: 'POST',
        body: JSON.stringify({
          turnstileToken: turnstileToken || '',
          powChallenge: powSolution.challenge,
          powNonce: powSolution.nonce,
        }),
      });

      // Step 2: Prompt browser passkey creation
      const attResp = await PasskeyClient.registerPasskey(optionsRes.options);

      // Step 3: Verify with server → auto-creates session
      const verifyRes = await apiRequest('/api/auth/register-passkey/verify', {
        method: 'POST',
        body: JSON.stringify({
          registrationResponse: attResp,
          deviceName: deviceName || 'Primary Passkey',
          userId: optionsRes.userId,
          expectedChallenge: optionsRes.options.challenge,
        }),
      });

      setIsAuthenticated(true);
      setUser(verifyRes.user);

      return { userId: verifyRes.user.id, userSalt: verifyRes.user.userSalt || optionsRes.userSalt };
    } finally {
      setIsLoading(false);
    }
  };

  // ── Login with existing passkey ──
  const loginWithPasskey = async () => {
    setIsLoading(true);
    try {
      // Step 1: Get authentication challenge
      const optionsRes = await apiRequest('/api/auth/login-passkey/options', { method: 'POST' });

      // Step 2: Browser passkey authentication
      const assertionResp = await PasskeyClient.authenticatePasskey(optionsRes.options);

      // Step 3: Verify with server
      const verifyRes = await apiRequest('/api/auth/login-passkey/verify', {
        method: 'POST',
        body: JSON.stringify({
          authenticationResponse: assertionResp,
          expectedChallenge: optionsRes.options.challenge,
        }),
      });

      setIsAuthenticated(true);
      setUser(verifyRes.user);

      // Try restoring VMK from sessionStorage (if same tab)
      const restored = await restoreVmkFromSession();
      if (restored) {
        setKeys(restored);
        setIsUnlocked(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Legacy Vault ID helper (Vault ID alone is not an auth method) ──
  const loginWithVaultId = async (_vaultId: string) => {
    throw new Error('Vault ID alone cannot grant session access. Please authenticate using your Passkey or 24-word Emergency Recovery Kit.');
  };

  // ── Unlock vault with passphrase (derives encryption keys) ──
  const unlockWithPassphrase = async (passphrase: string) => {
    if (!user) throw new Error('Must authenticate before unlocking.');
    setIsLoading(true);
    try {
      const userId = user.id;
      const encoder = new TextEncoder();

      const userSalt = user.userSalt || userId;
      const isRealSalt = userSalt.length > 20 && userSalt !== userId;
      const saltString = isRealSalt
        ? `nook_salt_${userSalt}`
        : `myvault_salt_${userId}`;

      const saltBytes = encoder.encode(saltString);
      const vmk = await deriveVaultMasterKey(passphrase, saltBytes);
      const { metadataKey, fileWrappingKey } = await deriveDomainSubkeys(vmk);

      const derivedKeys: CryptoKeys = { vmk, metadataKey, fileWrappingKey };

      // ── Passphrase Validation: Test derived key before unlocking ──
      const canaryKey = `nook_canary_${userId}`;
      const existingCanary = localStorage.getItem(canaryKey);

      if (existingCanary) {
        try {
          const decrypted = await decryptString(metadataKey, existingCanary);
          if (decrypted !== 'NOOK_KEY_VERIFIED') {
            throw new Error('Incorrect passphrase.');
          }
        } catch {
          throw new Error('Incorrect passphrase. Please check your credentials.');
        }
      } else {
        // No local canary: test against existing server folders/files
        let isExistingVault = false;
        let isKeyValid = false;

        try {
          const [folderRes, fileRes] = await Promise.all([
            apiRequest('/api/folders').catch(() => ({ folders: [] })),
            apiRequest('/api/files').catch(() => ({ files: [] })),
          ]);

          const folders = folderRes.folders || [];
          const files = fileRes.files || [];

          if (folders.length > 0 || files.length > 0) {
            isExistingVault = true;

            for (const folder of folders) {
              try {
                const name = await decryptString(metadataKey, folder.encrypted_name);
                if (name && name !== '[Decryption Error]') {
                  isKeyValid = true;
                  break;
                }
              } catch {}
            }

            if (!isKeyValid) {
              for (const file of files) {
                try {
                  const meta = await decryptMetadata(metadataKey, file.encrypted_metadata);
                  if (meta && meta.originalName) {
                    isKeyValid = true;
                    break;
                  }
                } catch {
                  try {
                    const name = await decryptString(metadataKey, file.encrypted_name);
                    if (name && name !== '[Decryption Error]') {
                      isKeyValid = true;
                      break;
                    }
                  } catch {}
                }
              }
            }
          }
        } catch (err: any) {
          if (err.message?.includes('Incorrect passphrase')) throw err;
        }

        if (isExistingVault && !isKeyValid) {
          throw new Error('Incorrect passphrase. Derived encryption key does not match vault data.');
        }

        // Key verified or brand new vault -> set canary envelope
        try {
          const newCanary = await encryptString(metadataKey, 'NOOK_KEY_VERIFIED');
          localStorage.setItem(canaryKey, newCanary);
        } catch {}
      }

      setKeys(derivedKeys);
      setIsUnlocked(true);

      // Persist VMK in sessionStorage for page reload resilience
      await persistVmkToSession(vmk);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Emergency recovery: Vault ID + 24-word phrase ──
  const loginWithRecoveryPhrase = async (vaultId: string, recoveryPhrase: string) => {
    setIsLoading(true);
    try {
      // 1. Normalize key
      const normalizedPhrase = RecoveryManager.normalizeKey(recoveryPhrase);

      // 2. Fetch recovery envelope (requires vault ID)
      const materialRes = await apiRequest(`/api/recovery/material?vaultId=${encodeURIComponent(vaultId)}`);
      if (!materialRes.material?.encrypted_vault_key) {
        throw new Error('No recovery kit found for this Vault ID.');
      }

      // 3. Compute recoveryKeyHash proof on client
      const encoder = new TextEncoder();
      const phraseHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(normalizedPhrase.trim().toLowerCase()) as BufferSource);
      const recoveryKeyHash = arrayBufferToBase64Url(new Uint8Array(phraseHashBuffer));

      // 4. Authenticate session on server WITH cryptographic recovery proof
      const res = await apiRequest('/api/recovery/authenticate', {
        method: 'POST',
        body: JSON.stringify({ vaultId, recoveryKeyHash, deviceName: 'Emergency Recovery' }),
      });

      // 5. Decrypt VMK locally with recovery phrase
      const vmk = await RecoveryManager.decryptRecoveryEnvelope(
        materialRes.material.encrypted_vault_key, normalizedPhrase
      );
      const { metadataKey, fileWrappingKey } = await deriveDomainSubkeys(vmk);

      // 6. Update local canary for instant future validation
      try {
        const newCanary = await encryptString(metadataKey, 'NOOK_KEY_VERIFIED');
        localStorage.setItem(`nook_canary_${res.user.id}`, newCanary);
      } catch {}

      setKeys({ vmk, metadataKey, fileWrappingKey });
      setIsAuthenticated(true);
      setIsUnlocked(true);
      setUser(res.user);

      await persistVmkToSession(vmk);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Register additional passkey on current account ──
  const registerAdditionalPasskey = async (deviceName?: string) => {
    const optionsRes = await apiRequest('/api/auth/register-passkey/options', { method: 'POST' });
    const attResp = await PasskeyClient.registerPasskey(optionsRes.options);
    await apiRequest('/api/auth/register-passkey/verify', {
      method: 'POST',
      body: JSON.stringify({
        registrationResponse: attResp,
        deviceName: deviceName || 'Additional Passkey',
        userId: user?.id,
        expectedChallenge: optionsRes.options.challenge,
      }),
    });
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {}

    // Clear all client-side storage, caches, and cookies
    try {
      sessionStorage.clear();
      localStorage.clear();
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((name) => caches.delete(name)));
      }
      if ('indexedDB' in window && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        dbs.forEach((db) => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      }
    } catch {}

    setIsAuthenticated(false);
    setIsUnlocked(false);
    setKeys(null);
    setUser(null);
    clearVmkSession();

    try {
      sessionStorage.setItem('nook_logout_popup', '1');
    } catch {}
  };

  const deleteAccount = async (passphrase?: string) => {
    if (!passphrase || !passphrase.trim()) {
      throw new Error('Please enter your passphrase to confirm account deletion.');
    }

    if (!user) {
      throw new Error('No active user session found.');
    }

    const userId = user.id;
    const userSalt = user.userSalt || userId;
    const isRealSalt = userSalt.length > 20 && userSalt !== userId;
    const saltString = isRealSalt
      ? `nook_salt_${userSalt}`
      : `myvault_salt_${userId}`;

    const encoder = new TextEncoder();
    const saltBytes = encoder.encode(saltString);
    const derivedVmk = await deriveVaultMasterKey(passphrase.trim(), saltBytes);

    let isKeyValid = false;

    if (keys?.vmk) {
      try {
        const activeRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keys.vmk));
        const derivedRaw = new Uint8Array(await crypto.subtle.exportKey('raw', derivedVmk));
        if (activeRaw.length === derivedRaw.length && activeRaw.every((val, idx) => val === derivedRaw[idx])) {
          isKeyValid = true;
        }
      } catch {}
    }

    if (!isKeyValid) {
      const canaryKey = `nook_canary_${userId}`;
      const existingCanary = localStorage.getItem(canaryKey);
      if (existingCanary) {
        try {
          const { metadataKey } = await deriveDomainSubkeys(derivedVmk);
          const decrypted = await decryptString(metadataKey, existingCanary);
          if (decrypted === 'NOOK_KEY_VERIFIED') {
            isKeyValid = true;
          }
        } catch {}
      }
    }

    if (!isKeyValid) {
      throw new Error('Incorrect passphrase. Account deletion cancelled.');
    }

    // Step 1: Request a single-use deletion confirmation token (2-minute TTL)
    const { token } = await apiRequest('/api/account/delete-request', { method: 'POST' });
    // Step 2: Confirm deletion by presenting the token
    await apiRequest('/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ confirmToken: token }),
    });
    setIsAuthenticated(false);
    setIsUnlocked(false);
    setKeys(null);
    setUser(null);
    clearVmkSession();
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated, isUnlocked, isLoading, user, keys,
      createVaultWithPasskey, loginWithPasskey, loginWithVaultId,
      unlockWithPassphrase, loginWithRecoveryPhrase,
      registerAdditionalPasskey, logout, deleteAccount, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
