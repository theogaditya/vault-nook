# MyVault Threat Model & Security Specification

**System Name:** MyVault Zero-Knowledge Personal Cloud Vault  
**Primary Domain:** `vault.adityahota99.workers.dev`  
**Version:** 2.0  

---

## 1. Primary Security Objective

The core promise of MyVault is:

> **Compromise of the Cloudflare Worker runtime, D1 database, or R2 storage bucket must NOT automatically expose plaintext vault files or unencrypted metadata to an attacker.**

---

## 2. Threat Matrix & Mitigation

| Threat Vector | Attacker Capability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **R2 Storage Compromise** | Full read/write access to R2 bucket `myvault`. | Attacker obtains opaque binary blobs. | Objects in R2 are encrypted with AES-256-GCM. No metadata, file names, or keys are stored in R2. Confidentiality is preserved. |
| **D1 Database Leakage** | Complete dump of D1 SQLite database tables. | Attacker obtains user IDs, hashed tokens, encrypted file keys, and encrypted file names. | Vault Master Key is never stored in D1. File keys are encrypted client-side (`AES-GCM-Encrypt(VMK, FK)`). Without VMK, file names and file contents remain encrypted. |
| **Cloudflare Worker Compromise** | Execution access inside Worker runtime. | Attacker can inspect runtime variables, attempt man-in-the-middle on requests. | VMK is never sent to the Worker. Ciphertext streaming passes through Worker without decryption capabilities. |
| **Stolen Session Cookie** | Attacker steals `myvault_session` cookie from network or browser. | Attacker can perform authorized vault file operations (list, upload, download ciphertext). | Sessions bound to device ID & user agent. HttpOnly, Secure, SameSite=Lax flags prevent XSS exfiltration. User can instantly trigger "Revoke All Sessions". |
| **Device Theft / Physical Access** | Physical access to logged-in user computer. | Attacker accesses unlocked vault in browser memory. | WebAuthn passkey re-authentication required for sensitive actions. Session timeout and local Vault lock options. Recovery key required to enroll new devices. |
| **Ciphertext Tampering** | Attacker modifies R2 object binary bytes. | Corrupted file download. | AES-256-GCM provides authenticated encryption with 128-bit authentication tags. GCM integrity check fails on client side upon decryption; tamper attempt logged. |
| **Brute-Force Passkey / Login** | Automated login requests. | Account lockout or resource consumption. | Rate limiting implemented on authentication endpoints (`/api/auth/*`). WebAuthn cryptographic challenges prevent credential replay. |

---

## 3. Trusted vs. Untrusted Components

### Trusted Boundary
- **User's Authenticated Device:** Browser environment executing client-side WebCrypto scripts.
- **User's Cryptographic Credentials:** Passkey private key held in secure hardware (Secure Enclave / TPM) & Vault Master Key (VMK).
- **User Recovery Material:** Offline 24-word recovery seed / recovery master key.

### Untrusted Boundary
- **Cloudflare Worker API:** Handles routing and authorization logic only.
- **Cloudflare D1 Database:** Untrusted metadata store.
- **Cloudflare R2 Bucket:** Untrusted object store.
- **Network Path (Internet):** Transport layer protected via mandatory TLS 1.3 / HTTPS.

---

## 4. Threat Model Limitations & Explicit Out-of-Scope Risks

1. **Compromised End-User Device Hardware / Malware:** If an attacker deploys active keyloggers or memory dumpers on the user's local operating system while the vault is unlocked, the attacker may obtain the Vault Master Key from browser memory. No cloud system can protect against active endpoint malware.
2. **Malicious Browser Extensions:** Browser extensions with excessive permissions running on the user's machine could inspect DOM memory. Users must only use trusted browser profiles.
