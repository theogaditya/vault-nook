# Nook — Zero-Knowledge Personal Cloud Vault

> **Your files, encrypted in your browser, stored in Cloudflare. The server never sees plaintext — ever.**

**Live:** `vault.adityahota99.workers.dev` · **Version:** 2.0 · **Stack:** React + Cloudflare Workers + D1 + R2

---

## What Is Nook?

Nook is a **privacy-first personal cloud vault**. Files are encrypted client-side in the browser using the Web Crypto API before any bytes leave the device. The backend (Cloudflare Worker, D1, R2) stores and serves only opaque ciphertext — it has no cryptographic ability to read your files, file names, or folder paths.

**Core promise:** A full compromise of the Cloudflare Worker runtime, D1 database, and R2 bucket must not expose plaintext files or metadata.

---

## Architecture at a Glance

```
┌──────────────────────────────────────┐
│           USER DEVICE (Trusted)      │
│  React UI · WebCrypto · WebAuthn     │
│  AES-256-GCM encrypt/decrypt locally │
└──────────────────┬───────────────────┘
                   │ HTTPS / TLS 1.3
                   ▼
┌──────────────────────────────────────┐
│     Cloudflare Worker (Untrusted)    │
│  Auth · Session · Access Control     │
│  Routes API requests, never decrypts │
└──────────┬───────────────────────────┘
           │                │
           ▼                ▼
  ┌─────────────┐   ┌──────────────────┐
  │ Cloudflare  │   │  Cloudflare R2   │
  │ D1 (myvault-│   │  (myvault bucket)│
  │   db)       │   │  Opaque chunks   │
  │ Encrypted   │   │  keyed by UUID,  │
  │ metadata    │   │  no filenames    │
  └─────────────┘   └──────────────────┘
```

| Layer | Role | Trusted? |
|---|---|---|
| Browser | Encryption engine, UI | ✅ Yes |
| Cloudflare Worker | API router, auth, access control | ❌ No |
| Cloudflare D1 | Encrypted metadata store (SQLite) | ❌ No |
| Cloudflare R2 | Encrypted binary object store | ❌ No |

---

## Cryptographic Key Hierarchy

```
User Passphrase  (never transmitted)
       │
       ▼  Argon2id WASM Web Worker · m=25 MiB, t=3, p=1 · per-account random salt
Vault Master Key (VMK)  — 256-bit AES-GCM
       ├──▶  HKDF 'nook-metadata'   → Metadata Key (MK)  — encrypts file/folder names
       └──▶  HKDF 'nook-file-wrapping' → File Wrapping Key (FWK)
                                              │
                                              ▼  Wraps a fresh 256-bit key per file
                                         Per-File Key (FK)
                                              │
                                              ▼  AES-256-GCM
                                         File chunks  (IV · Ciphertext · GCM Auth Tag + AAD)
```

**The VMK never leaves the browser.** D1 only holds encrypted key envelopes; without the VMK they are worthless.

---

## Feature Set

### Storage & File Operations
- **Upload files** of any type (PDF, DOCX, XLSX, images, video, ZIP, EXE, arbitrary binary).
- **Upload entire folders** — directory hierarchy is preserved; each file is independently encrypted.
- **Drag-and-drop upload** — drop files or entire folder trees directly onto the vault canvas; recursive `DataTransferItem` traversal reconstructs the full directory structure before encrypting.
- **Chunked streaming upload** — 5 MB chunks, never fully buffered in browser or Worker memory.
- **Max file size:** 500 MB per upload session. **Storage quota:** 500 MB per account (enforced server-side at upload init; configurable per tier).
- **Storage quota display** — used / total bytes shown live in the sidebar UI; refreshed after every upload or delete.
- **Download** — chunks are streamed back, decrypted chunk-by-chunk in the browser, and reassembled as a native browser download.
- **Rename** files and folders (new name re-encrypted client-side; only ciphertext written to D1).
- **Move** files across the folder tree.
- **Delete** files and folders (permanently removes all R2 chunk objects and all D1 metadata rows).
- **Create folder** — nested folders with full parent/child relationships in D1.
- **Multi-select** — select multiple items for bulk delete.
- **Upload progress indicator** with per-chunk granularity; separate download progress indicator.
- **Retry failed chunks** automatically on transient network errors.

### In-Browser File Preview & Note Editor
- **PDF** — rendered inline via browser native renderer.
- **DOCX / DOC** — rendered via `mammoth` + `docx-preview`.
- **XLSX / XLS** — parsed and tabulated via `xlsx`.
- **Images** (JPG, PNG, GIF, WebP, SVG) — rendered inline.
- **Plain text / Code** — rendered with monospace display.
- **Video / Audio** — streamed inline via in-memory Blob URL (file is decrypted on the fly; never written to disk).
- **Unsupported types** — graceful fallback to download prompt.
- **Built-in Markdown note editor** — create encrypted `.md` notes directly inside the vault without leaving the browser. The editor has three tab modes: **Write** (raw Markdown), **Preview** (rendered HTML), and **Code** (raw source). Notes are encrypted and uploaded as regular vault files; edits on existing `.md` files open the same editor. No third-party note service; the note is just another AES-256-GCM ciphertext in R2.

### Authentication — WebAuthn / Passkeys
- **No email required.** Accounts are identified by a randomly generated 128-bit ID (`user_01J...`).
- **No passwords stored on the server.** The backend holds WebAuthn public keys only.
- **Register a new device** — generates a passkey credential bound to the device's secure hardware (Secure Enclave / TPM).
- **Authenticate** — WebAuthn challenge-response; private key never leaves the hardware.
- **Multi-device support** — up to 3 trusted devices per account, each with its own independent passkey.
- **Revoke a device** — instantly invalidates the device's credential and all associated sessions in D1.
- **List devices** — view name, registration date, last-seen timestamp, revocation status.
- **Session management** — view all active sessions (device · IP · user agent · expiry); revoke individual or all sessions.

### Account Recovery
- During onboarding, Nook generates a **24-word BIP-39 mnemonic** recovery kit.
- `recoveryKey = Argon2id(recoveryPhrase)` → derived via Argon2id WASM Web Worker (`m=25 MiB, t=3, p=1`) with a fresh random salt to encrypt a copy of the VMK.
- The encrypted envelope + SHA-256 hash of the phrase are stored in D1. The plaintext phrase is **never uploaded**.
- Recovery flow: enter 24-word phrase on any browser → VMK decrypted locally → new device enrolled → vault accessible.

### Security & Access Control
- **Secure session cookies** — `HttpOnly`, `Secure`, `SameSite=Lax`; no tokens in URLs or `localStorage`.
- **Anti-bot signup protection** — Cloudflare Turnstile integration on `AuthScreen.tsx` verified server-side (`verifyTurnstileToken()`) to block bot signups.
- **Client Proof-of-Work (Hashcash)** — Clients solve a lightweight SHA-256 computational puzzle (~200ms–1s CPU) before an account ID is issued, making automated mass registrations computationally expensive. PoW nonces are tracked in D1 to prevent replay attacks.
- **Per-IP rate limiting & CGNAT ASN intelligence** — Standard IPs are limited to 5 account signups per 24 hours. CGNAT and mobile carrier ranges (detected via Cloudflare `request.cf` ASN/ISP metadata) are expanded to 25 signups per 24 hours and paired with Turnstile + PoW so legitimate users sharing mobile carrier NATs are never blocked. Rate limiting is backed by D1 for cross-instance consistency.
- **Rate limiting** — 60 upload-init requests per minute per IP/user; auth endpoints rate-limited. All rate limit counters persisted in D1.
- **Two-step account deletion** — Account deletion requires a confirmation token sent to the user to prevent accidental or malicious deletion.
- **Security headers** — `CSP`, `HSTS`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **GCM integrity check** — AES-256-GCM auth tags verified on each chunk; tamper attempts caught client-side.
- **Ownership checks** — every API call verifies the requesting user owns the target resource.
- **Server-side quota enforcement** — upload init rejected if `storage_used + file_size > quota`.
- **Scheduled cleanup jobs** — Cron-triggered cleanup of expired sessions, upload sessions, PoW nonces, and rate limit records (runs every 6 hours).

### Audit Logging
Every significant event is recorded in D1 with timestamp, IP, and user agent:

`LOGIN_SUCCESS` · `LOGIN_FAILURE` · `DEVICE_REGISTERED` · `DEVICE_REVOKED` · `SESSION_CREATED` · `SESSION_REVOKED` · `FILE_UPLOADED` · `FILE_DOWNLOADED` · `FILE_DELETED` · `FILE_RENAMED` · `FILE_MOVED` · `SUSPICIOUS_ACTIVITY`

Sensitive material (VMK, session secrets, plaintext contents) is **never logged**.

### Onboarding
- New users see a **non-skippable guided tour** on first login covering: passphrase, device trust, recovery kit, and zero-knowledge model.
- Tour is mobile-optimized and single-pass.

### Search
- **Vault-wide filename search** — search bar in the navbar decrypts and matches filenames client-side across the entire vault (not just the current folder) when triggered from root. Scoped search within a folder when navigated into one.
- Search is performed entirely in the browser against the locally decrypted name cache — no plaintext query is ever sent to the Worker.

### UI / UX
- **Grid & List view** toggle for the file browser.
- **Breadcrumb navigation** for nested folders.
- **Sidebar** with quick-access to vault files, devices, sessions, audit trail, and recovery kit.
- **Storage quota bar** in the sidebar showing bytes used vs. account storage limit.
- **Toast notifications** for all async operations (upload success/failure, rename, delete, etc.).
- **Info modal** — per-file details: encrypted name, size, MIME type, upload date, chunk count.
- **Error boundaries** — isolated component failure never crashes the full vault UI.
- **Empty state CTAs** — drag-and-drop hint + quick-action buttons when a folder is empty.
- **Dark-themed, responsive design** — works on desktop and mobile browsers.

---

## R2 Storage Layout

Objects are stored as opaque UUID-keyed chunks — no filenames, extensions, or owner identities are embedded in R2 paths.

```
myvault/objects/<random-uuid>/
    chunk_000000   ← [IV (12B)] [AES-256-GCM ciphertext] [Auth Tag (16B)]
    chunk_000001
    chunk_000002
    ...
```

D1 records the `object_id` UUID that maps a file record to its R2 prefix.

---

## D1 Schema (Key Tables)

| Table | Purpose |
|---|---|
| `users` | Account ID, salt bytes, storage quota/used, timestamps |
| `devices` | WebAuthn credential ID, public key, device name, revocation status |
| `sessions` | Session token hash, device ID, expiry, IP, user agent |
| `folders` | `encrypted_name`, parent ID, user ownership |
| `files` | `encrypted_name`, `encrypted_metadata`, `encrypted_file_key`, `object_id`, size, MIME |
| `upload_sessions` | Upload ID, total chunks, uploaded chunks, status |
| `recovery_materials` | `encrypted_vault_key_envelope`, `recovery_key_hash` |
| `audit_logs` | Event type, IP, user agent, timestamp |
| `rate_limits` | D1-backed cross-instance rate limiting (key, count, reset timestamp) |
| `pow_nonces` | PoW nonce replay prevention (nonce hash, expiry) |
| `delete_confirmations` | Two-step account deletion confirmation tokens |

---

## Threat Model Summary

| Threat | Impact Without Nook | Impact With Nook |
|---|---|---|
| R2 bucket fully compromised | Plaintext files exposed | Attacker gets opaque binary blobs — useless without VMK |
| D1 database dumped | File names + metadata exposed | Only encrypted envelopes — useless without VMK |
| Cloudflare Worker runtime compromised | Man-in-the-middle on data | Worker only sees ciphertext; VMK never transmitted |
| Session cookie stolen | Full vault access | Attacker can list/upload/download ciphertext; cannot decrypt |
| Physical device theft | Vault open | Passkey re-auth required for sensitive ops; session timeout |
| Ciphertext tampered in R2 | Silent data corruption | GCM auth tag fails on decrypt; tamper detected client-side |

**Out of scope:** Active endpoint malware with keyloggers/memory dumpers; malicious browser extensions with DOM access.

---

## Tech Stack

| Concern | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Crypto | Argon2id (`hash-wasm` Web Worker), `WebCrypto` API (HKDF, AES-256-GCM) |
| Anti-Bot & Protection | Cloudflare Turnstile, SHA-256 Proof-of-Work (Hashcash), CGNAT/Carrier ASN Intelligence |
| Auth | `@simplewebauthn/browser` + `@simplewebauthn/server` |
| File Preview | `mammoth`, `docx-preview`, `xlsx` |
| Backend | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite-compatible) |
| Object Storage | Cloudflare R2 (private bucket) |
| Deployment | Wrangler CLI (`wrangler deploy`) |

---

## Repository Structure

```
pvtvalt/
├── src/
│   ├── worker/
│   │   ├── index.ts              # Entry point — router, CORS, security headers
│   │   ├── types.ts              # Shared Worker env types
│   │   ├── middleware/           # Auth middleware, session validation
│   │   ├── routes/
│   │   │   ├── auth.ts           # WebAuthn register/login/logout
│   │   │   ├── devices.ts        # List, revoke trusted devices
│   │   │   ├── sessions.ts       # List, revoke active sessions
│   │   │   ├── folders.ts        # CRUD folders
│   │   │   ├── files.ts          # File metadata, rename, delete
│   │   │   ├── uploads.ts        # Chunked upload init, chunk PUT, complete
│   │   │   ├── recovery.ts       # Recovery kit store/verify
│   │   │   ├── account.ts        # Account deletion
│   │   │   └── audit.ts          # Audit log retrieval
│   │   └── services/             # R2, D1, audit helper services
│   ├── crypto/
│   │   ├── keys.ts               # Key derivation, HKDF MK/FWK, key import/export
│   │   ├── argon2.worker.ts      # Argon2id WASM key derivation Web Worker
│   │   ├── argon2Worker.ts       # Argon2id Web Worker manager client
│   │   ├── pow.ts                # SHA-256 Proof-of-Work (Hashcash) puzzle solver/verifier
│   │   ├── cipher.ts             # AES-256-GCM encrypt/decrypt, IV generation
│   │   ├── recovery.ts           # BIP-39 mnemonic generation, recovery key derivation
│   │   └── webauthn.ts           # WebAuthn client helpers
│   └── frontend/
│       ├── App.tsx               # Root component, routing, drag-and-drop handler
│       ├── main.tsx
│       ├── index.css
│       ├── api/                  # Typed fetch wrappers for all Worker endpoints
│       ├── hooks/
│       │   ├── useAuth.tsx       # Auth state, vault lock/unlock, passphrase, quota
│       │   ├── useVault.ts       # Folder/file listing, search, CRUD ops
│       │   ├── useUploader.ts    # Chunked upload orchestration, drag-and-drop
│       │   └── useDownloader.ts  # Chunked download + in-browser decrypt
│       └── components/
│           ├── AuthScreen.tsx        # Passkey login/register UI
│           ├── TurnstileWidget.tsx   # Cloudflare Turnstile anti-bot protection widget
│           ├── LandingPage.tsx       # Public marketing landing page
│           ├── Navbar.tsx            # Top bar, breadcrumbs, search
│           ├── Sidebar.tsx           # Tab nav, storage quota bar
│           ├── FileGrid.tsx          # Grid view
│           ├── FileList.tsx          # List view
│           ├── DocumentViewerModal.tsx  # File preview + Markdown note editor
│           ├── UploadModal.tsx       # Upload/download progress overlay
│           ├── CreateFolderModal.tsx
│           ├── RenameModal.tsx
│           ├── MoveModal.tsx
│           ├── DeviceManager.tsx
│           ├── SessionManager.tsx
│           ├── AuditLogViewer.tsx
│           ├── RecoveryModal.tsx
│           ├── OnboardingTour.tsx    # Non-skippable first-run tour
│           ├── InfoModal.tsx         # About / Privacy / Terms
│           ├── Toast.tsx
│           ├── SiteFooter.tsx
│           └── ErrorBoundary.tsx
├── migrations/
│   ├── 0001_initial_schema.sql      # Full D1 schema
│   ├── 0002_nook_multitenant.sql    # Multi-tenant isolation additions
│   └── 0003_security_hardening.sql  # D1-backed rate limiting, PoW nonce replay prevention, account deletion confirmations
├── docs/
│   ├── architecture.md           # System architecture deep-dive
│   ├── crypto-spec.md            # Key hierarchy, Argon2id/HKDF params, recovery model
│   ├── file-format.md            # Binary chunk format, metadata envelope spec
│   └── threat-model.md           # Threat matrix, trust boundaries
├── .semgrep.yml                  # Custom Semgrep SAST security ruleset
├── SEMGREP_REPORT_2026_08_20.md  # Semgrep SAST security audit report
├── wrangler.toml                 # Worker name, D1 + R2 bindings, observability
└── package.json
```

---

## Deployment

```bash
# Install dependencies
npm install

# Run locally (Vite dev server + Wrangler local D1/R2)
npm run dev

# Apply D1 migrations (remote)
npm run d1:migrate

# Deploy to Cloudflare Workers
npm run deploy
```

---

## Docs Index

| Doc | What it covers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Full system diagram, component responsibilities, upload/download data flows |
| [`docs/crypto-spec.md`](docs/crypto-spec.md) | Key hierarchy, Argon2id/HKDF parameters, recovery kit model, quota enforcement |
| [`docs/file-format.md`](docs/file-format.md) | R2 binary chunk format (byte-level), encrypted metadata envelope, file key envelope |
| [`docs/threat-model.md`](docs/threat-model.md) | Threat matrix, trusted vs. untrusted boundaries, explicit out-of-scope risks |
| [`SEMGREP_REPORT_2026_08_20.md`](SEMGREP_REPORT_2026_08_20.md) | Semgrep SAST security scan results & rule verification |
