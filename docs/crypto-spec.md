# Nook — Cryptographic & Multi-Tenant Security Specification

## 1. Overview
Nook is a privacy-first, zero-knowledge encrypted cloud storage application built on Cloudflare Workers, D1, and R2.

This document defines the cryptographic key hierarchy, multi-tenant isolation guarantees, recovery model, and security primitives for Nook.

---

## 2. Privacy-First Identity & Account Model
- **No Email Requirement**: Accounts are identified by cryptographically generated 128-bit random IDs (`user_01J...`).
- **WebAuthn / Passkeys**: Primary authentication uses WebAuthn credentials. The backend stores public keys and credential IDs (`credential_id`).
- **No Fingerprinting / No MAC Address Auth**: Physical hardware metadata, MAC addresses, or browser fingerprints are never used to grant access.

---

## 3. Cryptographic Key Hierarchy

Every user's vault is cryptographically isolated. A compromise of one user's account or database row cannot compromise another user's vault.

```text
User Passphrase (or Offline Seed)
       ↓ (Argon2id WASM Web Worker [m=25 MiB, t=3, p=1] + Per-Account Salt)
Vault Master Key (VMK) — 256-bit AES-GCM
       ├── (HKDF-SHA256 'nook-metadata' + Metadata Salt) → Metadata Key (MK)
       └── (HKDF-SHA256 'nook-file-wrapping' + File Salt) → File Wrapping Key (FWK)
                                                                  ↓
                                                     Per-File File Key (FK) — 256-bit AES-GCM
                                                                  ↓
                                                     File Chunks — AES-256-GCM (5MB Chunks + IV + Auth Tag + AAD)
```

### Key Expansion & Derivation Primitives
1. **Per-Account Master Salt**: Randomly generated 32-byte cryptographically secure salt (`user_salt_bytes`) stored in D1 alongside the user account record.
   - *Rule*: Email is **NEVER** used as a salt or cryptographic input.
2. **Vault Master Key (VMK)**: Derived client-side off the main UI thread via a dedicated Web Worker running WASM **Argon2id** (`m=25 MiB` / `25600 KiB`, `t=3`, `p=1`, `hashLength=32`) using the user's Master Passphrase and the account's random salt.
3. **Metadata Key (MK)**: Derived via HKDF from `VMK` with info string `'nook-metadata'`. Used for client-side AES-GCM encryption of folder names, file names, and file metadata JSON.
4. **File Wrapping Key (FWK)**: Derived via HKDF from `VMK` with info string `'nook-file-wrapping'`. Used to wrap individual per-file random AES keys.
5. **Per-File Key (FK)**: Fresh 256-bit AES-GCM key generated per file. Encrypted with `FWK` and stored in D1 as `encrypted_file_key`.

---

## 4. Emergency Recovery Kit Model

If a user loses all registered Passkey devices:
1. During setup, Nook client generates a 24-word BIP-39 mnemonic recovery phrase (`recoveryPhrase`).
2. Client derives `recoveryKey` from `recoveryPhrase` using Argon2id WASM Web Worker (`m=25 MiB`, `t=3`, `p=1`) + per-envelope random 32-byte salt.
3. Client encrypts `VMK` using `recoveryKey` to produce `encrypted_vault_key_envelope`.
4. Client computes `recoveryKeyHash` = SHA-256(`recoveryPhrase`) and uploads `encrypted_vault_key_envelope` + `recoveryKeyHash` to D1.
5. **Recovery Flow**: The user enters their 24-word phrase on any browser -> Client decrypts `encrypted_vault_key_envelope` locally via Argon2id to recover `VMK` -> Re-derives `MK` & `FWK`. Server never receives the plaintext `VMK`.

---

## 5. Storage Quotas & Abuse Protection
- **Default Storage Quota**: 500 MB (`524,288,000` bytes) per user (except specific accounts such as `user_ae71159c13ca4ba78b0b24ccd827a5b3` configured for 1 GB).
- **Trusted Device Limit**: Up to 3 connected devices per account.
- **Server-Side Quota Enforcement**: `POST /api/uploads/init` checks `storage_used_bytes + incoming_file_size <= storage_quota_bytes`.
- **Upload Rate Limiting**: Max 60 upload init requests per minute per IP / User ID.
- **Max File Size**: 500 MB per single file upload session.

---

## 6. Account Deletion Workflow
When a user deletes their account (`DELETE /api/account`):
1. **Revoke Active Sessions & Devices**: Immediately invalidates all session tokens and passkeys in D1.
2. **Delete R2 Objects**: Queries all `object_id` references owned by `user_id` and bulk-deletes them from private R2 bucket `myvault`.
3. **Purge D1 Metadata**: Deletes all user rows from `files`, `folders`, `devices`, `sessions`, `recovery_materials`, `audit_logs`, and `users`.
