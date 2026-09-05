/**
 * Nook Worker Environment Bindings and Request Interfaces
 */

export interface Env {
  DB: D1Database;
  MYVAULT_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  TURNSTILE_SECRET_KEY?: string;
}

export interface UserRecord {
  id: string;
  user_salt: string;
  storage_used_bytes: number;
  storage_quota_bytes: number;
  status: 'active' | 'disabled';
  created_at: number;
  updated_at: number;
}

export interface DeviceRecord {
  id: string;
  user_id: string;
  name: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports?: string;
  created_at: number;
  last_seen_at: number;
  revoked_at?: number | null;
}

export interface PhysicalDeviceRecord {
  id: string;
  user_id: string;
  name: string;
  device_fingerprint: string;
  user_agent?: string;
  ip_address?: string;
  created_at: number;
  last_seen_at: number;
  revoked_at?: number | null;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  device_id: string;
  token_hash: string;
  ip_address?: string;
  user_agent?: string;
  created_at: number;
  expires_at: number;
  revoked_at?: number | null;
  last_seen_at: number;
}

export interface FolderRecord {
  id: string;
  user_id: string;
  parent_id?: string | null;
  encrypted_name: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number | null;
}

export interface FileRecord {
  id: string;
  user_id: string;
  folder_id?: string | null;
  object_id: string;
  encrypted_name: string;
  encrypted_metadata: string;
  encrypted_file_key: string;
  size: number;
  mime_type: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number | null;
}

export interface UploadSessionRecord {
  id: string;
  user_id: string;
  file_id: string;
  object_id: string;
  total_chunks: number;
  uploaded_chunks: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  expires_at: number;
  created_at: number;
}

export interface AuditLogRecord {
  id: string;
  user_id?: string;
  device_id?: string;
  event_type: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: number;
  details?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  session?: SessionRecord;
  device?: DeviceRecord;
}
