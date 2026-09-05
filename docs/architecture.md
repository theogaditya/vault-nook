# MyVault Architecture Specification

**System Name:** MyVault Zero-Knowledge Personal Cloud Vault  
**Primary Domain:** `vault.adityahota99.workers.dev`  
**Version:** 2.0  

---

## 1. High-Level Architecture

MyVault is built on a zero-trust, browser-encrypted cloud storage architecture leveraging Cloudflare edge services.

```text
                               ┌─────────────────────────────────────────┐
                               │               USER DEVICE               │
                               │                                         │
                               │  ┌───────────────────────────────────┐  │
                               │  │  Browser / Client Application     │  │
                               │  │  - React UI                       │  │
                               │  │  - WebCrypto API                  │  │
                               │  │  - WebAuthn (Passkeys)            │  │
                               │  │  - AES-256-GCM / HKDF Engine       │  │
                               │  └─────────────────┬─────────────────┘  │
                               └────────────────────┼────────────────────┘
                                                    │ HTTPS (TLS 1.3)
                                                    v
                               ┌─────────────────────────────────────────┐
                               │           CLOUDFLARE WORKER             │
                               │      (vault.adityahota99.workers.dev)   │
                               │                                         │
                               │  - API Router & Request Validation      │
                               │  - WebAuthn Authentication & Sessions   │
                               │  - Access Control & Ownership Logic     │
                               │  - Scoped R2 / D1 Access Controller      │
                               │  - Audit Logging                        │
                               └───────────┬─────────────────┬───────────┘
                                           │                 │
                                  SQL Query│                 │Object API
                                           v                 v
                               ┌───────────────┐     ┌──────────────────┐
                               │ Cloudflare D1 │     │  Cloudflare R2   │
                               │ Database      │     │  Object Bucket   │
                               │ (myvault-db)  │     │  (myvault)       │
                               │ Metadata      │     │  Opaque Ciphertext│
                               └───────────────┘     └──────────────────┘
```

---

## 2. Component Breakdown

### 2.1 Browser (Client-Side Encryption Engine & UI)
- **Role:** Trusted Execution Environment.
- **Responsibilities:**
  - Generating and storing zero-knowledge cryptographic keys locally (never transmitted to Cloudflare).
  - Encrypting file content and metadata locally using AES-256-GCM before sending ciphertext.
  - Decrypting downloaded ciphertext in-memory using WebCrypto API.
  - WebAuthn signature generation for passwordless passkey login and device registration.
  - Streaming large files in 5MB chunks to minimize browser RAM footprint.

### 2.2 Cloudflare Worker (`vault.adityahota99.workers.dev`)
- **Role:** Untrusted Application Server & Access Control Proxy.
- **Responsibilities:**
  - Enforcing session authentication (Secure, HttpOnly, SameSite cookies).
  - Verifying WebAuthn assertions against device public keys.
  - Managing user session lifecycle, device registration, and revocation.
  - Authorizing chunked upload and download requests.
  - Reading/writing encrypted metadata to D1.
  - Reading/writing binary ciphertext chunks to R2.

### 2.3 Cloudflare D1 (`myvault-db`)
- **Role:** Relational Metadata Storage (SQLite-compatible).
- **Stored Data:**
  - Account metadata (User ID, timestamps).
  - Devices & WebAuthn credentials (Credential ID, Public Key, Device Name, Revocation Status).
  - Active Sessions (Session token hashes, Expiration, IP address, User Agent).
  - Folders (Folder ID, Parent ID, `encrypted_name`).
  - Files (File ID, Object ID, `encrypted_name`, `encrypted_metadata`, `encrypted_file_key`, Size, Mime Type).
  - Upload Sessions (Upload ID, Total Chunks, Uploaded Chunks, Status).
  - Audit Logs (Event types, IP addresses, Timestamps).

### 2.4 Cloudflare R2 (`myvault`)
- **Role:** Private Object Storage Bucket.
- **Stored Data:**
  - Opaque encrypted binary objects keyed by UUIDs (`myvault/objects/<random-uuid>/chunk_<index>`).
  - Zero metadata or unencrypted identifiers are attached to R2 objects.
  - Public access disabled; access is strictly restricted to the Worker binding.

---

## 3. Data Flow

### 3.1 File Upload Flow
```text
Client                                  Worker                                 D1 / R2
  │                                       │                                       │
  │ 1. Read file chunk (5MB)             │                                       │
  │ 2. AES-256-GCM Encrypt chunk         │                                       │
  │ 3. Encrypt file name & File Key      │                                       │
  │ 4. POST /api/uploads/init ───────────>│                                       │
  │    (with encrypted metadata)          │ 5. Validate session & device          │
  │                                       │ 6. Create upload record ─────────────>│ D1
  │<────────── uploadId ──────────────────┤                                       │
  │                                       │                                       │
  │ 7. PUT /api/uploads/:id/chunk/0 ─────>│                                       │
  │    (Ciphertext payload)               │ 8. Store chunk ──────────────────────>│ R2
  │<────────── 200 OK ────────────────────┤                                       │
  │    (... repeat for all chunks ...)    │                                       │
  │                                       │                                       │
  │ 9. POST /api/uploads/:id/complete ───>│                                       │
  │                                       │ 10. Verify chunk count & commit ─────>│ D1
  │<────────── 200 OK ────────────────────┤                                       │
```

### 3.2 File Download Flow
```text
Client                                  Worker                                 D1 / R2
  │                                       │                                       │
  │ 1. GET /api/files/:id ───────────────>│                                       │
  │                                       │ 2. Verify ownership & active session  │
  │                                       │ 3. Fetch file metadata ──────────────>│ D1
  │<──────── encrypted metadata ──────────┤                                       │
  │ 4. Decrypt File Key with Vault Key    │                                       │
  │                                       │                                       │
  │ 5. GET /api/files/:id/chunk/:idx ────>│                                       │
  │                                       │ 6. Fetch chunk ciphertext ───────────>│ R2
  │<──────── chunk ciphertext ────────────┤                                       │
  │ 7. Decrypt chunk with File Key        │                                       │
  │ 8. Reconstruct Blob / Stream download │                                       │
```

---

## 4. Operational Boundaries & Privacy Guarantees

1. **Zero Knowledge of Plaintext:** Neither Cloudflare Worker code, nor D1 records, nor R2 bucket objects contain plaintext file content, plaintext file names, or plaintext folder paths.
2. **Zero Knowledge of Encryption Keys:** The Vault Master Key (VMK) and File Keys (FK) are derived and stored in plaintext strictly within the browser memory on authorized user devices.
3. **Session Revocation:** Revoking a device instantly invalidates all associated authentication sessions in D1, preventing any subsequent storage API calls from that device.
