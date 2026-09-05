# MyVault Encrypted File Format Specification

**System Name:** MyVault Zero-Knowledge Personal Cloud Vault  
**Primary Domain:** `vault.adityahota99.workers.dev`  
**Version:** 2.0  

---

## 1. Overview

This document specifies the binary format for encrypted file objects stored in Cloudflare R2 (`myvault` bucket) and the metadata payload structure stored in Cloudflare D1 (`myvault-db`).

---

## 2. Storage Mapping

```text
D1 File Record                        R2 Storage Objects
┌────────────────────────────────┐    ┌───────────────────────────────────┐
│ id: "file_uuid_123"            │    │ myvault/objects/<object_id>/      │
│ object_id: "obj_uuid_999"      ├───>│   ├── chunk_000000                │
│ encrypted_name: "eyIV...eyData"│    │   ├── chunk_000001                │
│ encrypted_file_key: "ey..."    │    │   └── chunk_000002                │
└────────────────────────────────┘    └───────────────────────────────────┘
```

- **File ID:** Opaque UUIDv4 identifying the file entry in D1.
- **Object ID:** Opaque random UUIDv4 identifying the storage folder/prefix in R2. R2 object paths do NOT reveal original file names, file extensions, folder paths, or owner identities.

---

## 3. R2 Chunk Storage Binary Format

Each file is split into chunks of maximum size **5,242,880 bytes (5 MB)**.

Each chunk is stored in R2 at the path:
`objects/<object_id>/chunk_<index_padded>` (e.g., `objects/8f3b.../chunk_000000`)

### Binary Chunk Payload Layout

```text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                     Initialization Vector (IV)                |
|                             (12 Bytes)                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
|                   AES-256-GCM Encrypted Data                  |
|                      (Variable Chunk Size)                    |
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                   16-Byte GCM Authentication Tag              |
|                             (16 Bytes)                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

- **Bytes 0 - 11 (12 bytes):** Initialization Vector (IV) generated via `crypto.getRandomValues(12)`.
- **Bytes 12 - (N - 17):** Encrypted chunk data payload.
- **Bytes (N - 16) - (N - 1):** AES-256-GCM Authentication Tag.

---

## 4. Encrypted Metadata Envelope Format

In D1, file metadata is stored in Base64URL encoded strings containing the IV and GCM ciphertext payload.

### Envelope Structure
```text
<Base64Url(IV_12Bytes)>.<Base64Url(Ciphertext_And_Tag)>
```

### Decrypted JSON Metadata Object
When decrypted with the Metadata Key (MK), the JSON payload contains:

```json
{
  "version": 1,
  "originalName": "FinancialReport.xlsx",
  "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "size": 15482910,
  "checksum": "a3f5b...sha256_of_original_unencrypted_file",
  "totalChunks": 4,
  "chunkSize": 5242880,
  "created": 1755417600
}
```

---

## 5. Encrypted File Key Envelope Format

Stored in D1 `files.encrypted_file_key`.

Encrypted with File Wrapping Key (FWK):
```text
<Base64Url(IV_12Bytes)>.<Base64Url(Encrypted_32Byte_FileKey_And_Tag)>
```
- Decrypting this envelope yields the 256-bit AES-GCM File Key required to decrypt all chunks of the file.
