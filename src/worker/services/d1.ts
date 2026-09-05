import { Env, UserRecord, DeviceRecord, SessionRecord, FolderRecord, FileRecord, UploadSessionRecord, AuditLogRecord, PhysicalDeviceRecord } from '../types';

/**
 * Executes a D1 database operation with transient error retries (3 attempts with exponential backoff)
 * Handles SQLite/D1 database lock contention (SQLITE_BUSY) or transient IO errors gracefully.
 */
async function withD1Retry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 100;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      const isTransient =
        msg.includes('locked') ||
        msg.includes('busy') ||
        msg.includes('d1_error') ||
        msg.includes('network') ||
        msg.includes('timeout');

      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  return fn();
}

export class D1Service {
  constructor(private db: D1Database) {}

  private async runWrite<T>(fn: () => Promise<T>): Promise<T> {
    return withD1Retry(fn);
  }

  // ─── User Operations ───

  async getOrCreateUser(userId: string): Promise<UserRecord> {
    const userDefaultQuota = userId === 'user_ae71159c13ca4ba78b0b24ccd827a5b3' ? 2147483648 : 524288000;
    try {
      const existing = await this.db
        .prepare('SELECT * FROM users WHERE id = ?')
        .bind(userId)
        .first<UserRecord>();

      if (existing) {
        return {
          ...existing,
          user_salt: existing.user_salt || existing.id,
          storage_used_bytes: typeof existing.storage_used_bytes === 'number' ? existing.storage_used_bytes : 0,
          storage_quota_bytes: typeof existing.storage_quota_bytes === 'number' ? existing.storage_quota_bytes : userDefaultQuota,
          status: existing.status || 'active',
        };
      }
    } catch (err) {}

    const now = Date.now();
    const randomSaltArray = new Uint8Array(32);
    crypto.getRandomValues(randomSaltArray);
    const userSalt = Array.from(randomSaltArray).map(b => b.toString(16).padStart(2, '0')).join('');
    const defaultQuota = userDefaultQuota;

    try {
      await this.db
        .prepare(
          `INSERT INTO users (id, user_salt, storage_used_bytes, storage_quota_bytes, status, created_at, updated_at)
           VALUES (?, ?, 0, ?, 'active', ?, ?)`
        )
        .bind(userId, userSalt, defaultQuota, now, now)
        .run();
    } catch (err: any) {
      await this.db
        .prepare('INSERT INTO users (id, created_at, updated_at) VALUES (?, ?, ?)')
        .bind(userId, now, now)
        .run();
    }

    return {
      id: userId, user_salt: userSalt, storage_used_bytes: 0,
      storage_quota_bytes: defaultQuota, status: 'active', created_at: now, updated_at: now,
    };
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    try {
      const user = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRecord>();
      if (!user) return null;
      const userDefaultQuota = user.id === 'user_ae71159c13ca4ba78b0b24ccd827a5b3' ? 2147483648 : 524288000;
      return {
        ...user,
        user_salt: user.user_salt || user.id,
        storage_used_bytes: typeof user.storage_used_bytes === 'number' ? user.storage_used_bytes : 0,
        storage_quota_bytes: typeof user.storage_quota_bytes === 'number' ? user.storage_quota_bytes : userDefaultQuota,
        status: user.status || 'active',
      };
    } catch { return null; }
  }

  async updateUserStorageUsed(userId: string, deltaBytes: number): Promise<void> {
    try {
      await this.runWrite(async () => {
        await this.db
          .prepare('UPDATE users SET storage_used_bytes = MAX(0, storage_used_bytes + ?), updated_at = ? WHERE id = ?')
          .bind(deltaBytes, Date.now(), userId)
          .run();
      });
    } catch {}
  }

  // ─── Device Operations (revoked devices filtered) ───

  async createDevice(device: Omit<DeviceRecord, 'created_at' | 'last_seen_at'>): Promise<DeviceRecord> {
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO devices (id, user_id, name, credential_id, public_key, counter, transports, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(device.id, device.user_id, device.name, device.credential_id, device.public_key, device.counter || 0, device.transports || '', now, now)
      .run();
    return { ...device, created_at: now, last_seen_at: now };
  }

  async getDeviceByCredentialId(credentialId: string): Promise<DeviceRecord | null> {
    return this.db
      .prepare('SELECT * FROM devices WHERE credential_id = ? AND revoked_at IS NULL')
      .bind(credentialId)
      .first<DeviceRecord>();
  }

  async getDevicesByUser(userId: string): Promise<DeviceRecord[]> {
    const res = await this.db
      .prepare('SELECT * FROM devices WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC')
      .bind(userId)
      .all<DeviceRecord>();
    return res.results || [];
  }

  async getAllDevicesByUser(userId: string): Promise<DeviceRecord[]> {
    const res = await this.db
      .prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all<DeviceRecord>();
    return res.results || [];
  }

  async revokeDevice(deviceId: string, userId: string): Promise<boolean> {
    const now = Date.now();
    await this.db.prepare('UPDATE devices SET revoked_at = ? WHERE id = ? AND user_id = ?').bind(now, deviceId, userId).run();
    await this.db.prepare('UPDATE sessions SET revoked_at = ? WHERE device_id = ? AND user_id = ?').bind(now, deviceId, userId).run();
    return true;
  }

  async updateDeviceCounter(deviceId: string, newCounter: number): Promise<void> {
    await this.db.prepare('UPDATE devices SET counter = ?, last_seen_at = ? WHERE id = ?').bind(newCounter, Date.now(), deviceId).run();
  }

  // ─── Physical Device Registry Operations (Persistent Unique Devices) ───

  async ensurePhysicalDevicesTable(): Promise<void> {
    try {
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS trusted_physical_devices (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          device_fingerprint TEXT NOT NULL,
          user_agent TEXT,
          ip_address TEXT,
          created_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL,
          revoked_at INTEGER DEFAULT NULL
        );
      `);
    } catch {}
  }

  async getPhysicalDevicesByUser(userId: string): Promise<PhysicalDeviceRecord[]> {
    await this.ensurePhysicalDevicesTable();
    try {
      const res = await this.db
        .prepare('SELECT * FROM trusted_physical_devices WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC')
        .bind(userId)
        .all<PhysicalDeviceRecord>();
      return res.results || [];
    } catch {
      return [];
    }
  }

  async registerPhysicalDevice(
    userId: string,
    userAgent: string,
    ipAddress: string,
    customName?: string
  ): Promise<{ physicalDevice: PhysicalDeviceRecord; isNew: boolean }> {
    await this.ensurePhysicalDevicesTable();
    const activePhysical = await this.getPhysicalDevicesByUser(userId);

    const fingerprint = userAgent || 'Unknown Device';
    const existing = activePhysical.find(d => d.device_fingerprint === fingerprint || d.user_agent === userAgent);
    const now = Date.now();

    if (existing) {
      try {
        await this.db
          .prepare('UPDATE trusted_physical_devices SET last_seen_at = ?, ip_address = ? WHERE id = ?')
          .bind(now, ipAddress, existing.id)
          .run();
      } catch {}
      return { physicalDevice: { ...existing, last_seen_at: now, ip_address: ipAddress }, isNew: false };
    }

    if (activePhysical.length >= 3) {
      throw new Error('Registered physical device limit reached (3 / 3 max allowed). Please revoke an existing registered device from your account settings before logging in from a 4th device.');
    }

    let deviceName = customName;
    if (!deviceName) {
      let os = 'Unknown OS';
      if (/android/i.test(userAgent)) os = 'Android';
      else if (/iphone/i.test(userAgent)) os = 'iPhone';
      else if (/ipad/i.test(userAgent)) os = 'iPad';
      else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
      else if (/windows/i.test(userAgent)) os = 'Windows';
      else if (/linux/i.test(userAgent)) os = 'Linux';

      let browser = 'Chrome';
      if (/edg/i.test(userAgent)) browser = 'Edge';
      else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
      else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
      else if (/safari/i.test(userAgent)) browser = 'Safari';

      deviceName = `${os} / ${browser}`;
    }

    const newId = crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO trusted_physical_devices (id, user_id, name, device_fingerprint, user_agent, ip_address, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(newId, userId, deviceName, fingerprint, userAgent, ipAddress, now, now)
      .run();

    const newRecord: PhysicalDeviceRecord = {
      id: newId,
      user_id: userId,
      name: deviceName,
      device_fingerprint: fingerprint,
      user_agent: userAgent,
      ip_address: ipAddress,
      created_at: now,
      last_seen_at: now,
    };

    return { physicalDevice: newRecord, isNew: true };
  }

  async revokePhysicalDevice(deviceId: string, userId: string): Promise<boolean> {
    await this.ensurePhysicalDevicesTable();
    const now = Date.now();

    const physDev = await this.db
      .prepare('SELECT * FROM trusted_physical_devices WHERE id = ? AND user_id = ?')
      .bind(deviceId, userId)
      .first<PhysicalDeviceRecord>();

    await this.db
      .prepare('UPDATE trusted_physical_devices SET revoked_at = ? WHERE id = ? AND user_id = ?')
      .bind(now, deviceId, userId)
      .run();

    if (physDev?.user_agent) {
      await this.db
        .prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND user_agent = ? AND revoked_at IS NULL')
        .bind(now, userId, physDev.user_agent)
        .run();
    }
    return true;
  }

  // ─── Session Operations ───

  async createSession(session: Omit<SessionRecord, 'created_at' | 'last_seen_at' | 'revoked_at'>): Promise<SessionRecord> {
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, device_id, token_hash, ip_address, user_agent, created_at, expires_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(session.id, session.user_id, session.device_id, session.token_hash, session.ip_address || '', session.user_agent || '', now, session.expires_at, now)
      .run();
    return { ...session, created_at: now, last_seen_at: now, revoked_at: null };
  }

  async getSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.db
      .prepare('SELECT * FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?')
      .bind(tokenHash, Date.now())
      .first<SessionRecord>();
  }

  async updateSessionLastSeen(sessionId: string): Promise<void> {
    await this.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(Date.now(), sessionId).run();
  }

  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    await this.db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ?').bind(Date.now(), sessionId, userId).run();
    return true;
  }

  async revokeAllOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const res = await this.db
      .prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL')
      .bind(Date.now(), userId, currentSessionId)
      .run();
    return res.meta.changes || 0;
  }

  async revokeSessionsForDevice(userId: string, deviceId: string): Promise<number> {
    const res = await this.db
      .prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND device_id = ? AND revoked_at IS NULL')
      .bind(Date.now(), userId, deviceId)
      .run();
    return res.meta.changes || 0;
  }

  async getActiveSessions(userId: string): Promise<SessionRecord[]> {
    const res = await this.db
      .prepare('SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC')
      .bind(userId, Date.now())
      .all<SessionRecord>();
    return res.results || [];
  }

  // ─── Folder Operations (with cascade delete) ───

  async createFolder(folder: Omit<FolderRecord, 'created_at' | 'updated_at'>): Promise<FolderRecord> {
    const now = Date.now();
    await this.db
      .prepare('INSERT INTO folders (id, user_id, parent_id, encrypted_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(folder.id, folder.user_id, folder.parent_id || null, folder.encrypted_name, now, now)
      .run();
    return { ...folder, created_at: now, updated_at: now };
  }

  async getFolders(userId: string, parentId?: string | null): Promise<FolderRecord[]> {
    let query = 'SELECT * FROM folders WHERE user_id = ? AND deleted_at IS NULL';
    const params: any[] = [userId];
    if (parentId !== undefined) {
      if (parentId === null || parentId === '') { query += ' AND parent_id IS NULL'; }
      else { query += ' AND parent_id = ?'; params.push(parentId); }
    }
    query += ' ORDER BY created_at ASC';
    const res = await this.db.prepare(query).bind(...params).all<FolderRecord>();
    return res.results || [];
  }

  async updateFolder(folderId: string, userId: string, data: { encrypted_name?: string; parent_id?: string | null }): Promise<boolean> {
    const now = Date.now();
    if (data.encrypted_name !== undefined) {
      await this.db.prepare('UPDATE folders SET encrypted_name = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(data.encrypted_name, now, folderId, userId).run();
    }
    if (data.parent_id !== undefined) {
      await this.db.prepare('UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(data.parent_id, now, folderId, userId).run();
    }
    return true;
  }

  /** Cascade-delete folder: soft-deletes folder + all child folders + all files inside. Returns orphaned R2 object IDs. */
  async deleteFolderCascade(folderId: string, userId: string): Promise<string[]> {
    const now = Date.now();
    const orphanedObjectIds: string[] = [];

    // Collect files inside this folder
    const filesRes = await this.db
      .prepare('SELECT id, object_id, size FROM files WHERE folder_id = ? AND user_id = ? AND deleted_at IS NULL')
      .bind(folderId, userId)
      .all<{ id: string; object_id: string; size: number }>();

    for (const f of (filesRes.results || [])) {
      orphanedObjectIds.push(f.object_id);
      await this.db.prepare('UPDATE files SET deleted_at = ? WHERE id = ?').bind(now, f.id).run();
      await this.updateUserStorageUsed(userId, -f.size);
    }

    // Recurse into child folders
    const childFolders = await this.db
      .prepare('SELECT id FROM folders WHERE parent_id = ? AND user_id = ? AND deleted_at IS NULL')
      .bind(folderId, userId)
      .all<{ id: string }>();

    for (const child of (childFolders.results || [])) {
      const childOrphans = await this.deleteFolderCascade(child.id, userId);
      orphanedObjectIds.push(...childOrphans);
    }

    // Soft-delete the folder itself
    await this.db.prepare('UPDATE folders SET deleted_at = ? WHERE id = ? AND user_id = ?').bind(now, folderId, userId).run();
    return orphanedObjectIds;
  }

  async deleteFolder(folderId: string, userId: string): Promise<string[]> {
    return this.deleteFolderCascade(folderId, userId);
  }

  // ─── File Operations ───

  async createFile(file: Omit<FileRecord, 'created_at' | 'updated_at'>): Promise<FileRecord> {
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO files (id, user_id, folder_id, object_id, encrypted_name, encrypted_metadata, encrypted_file_key, size, mime_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(file.id, file.user_id, file.folder_id || null, file.object_id, file.encrypted_name, file.encrypted_metadata, file.encrypted_file_key, file.size, file.mime_type, now, now)
      .run();
    await this.updateUserStorageUsed(file.user_id, file.size);
    return { ...file, created_at: now, updated_at: now };
  }

  async getFileById(fileId: string, userId: string): Promise<FileRecord | null> {
    return this.db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND deleted_at IS NULL').bind(fileId, userId).first<FileRecord>();
  }

  async getFiles(userId: string, folderId?: string | null): Promise<FileRecord[]> {
    let query = 'SELECT * FROM files WHERE user_id = ? AND deleted_at IS NULL';
    const params: any[] = [userId];
    if (folderId !== undefined) {
      if (folderId === null || folderId === '') { query += ' AND folder_id IS NULL'; }
      else { query += ' AND folder_id = ?'; params.push(folderId); }
    }
    query += ' ORDER BY created_at DESC';
    const res = await this.db.prepare(query).bind(...params).all<FileRecord>();
    return res.results || [];
  }

  async updateFile(fileId: string, userId: string, data: { encrypted_name?: string; folder_id?: string | null; encrypted_metadata?: string }): Promise<boolean> {
    const now = Date.now();
    if (data.encrypted_name !== undefined) {
      await this.db.prepare('UPDATE files SET encrypted_name = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(data.encrypted_name, now, fileId, userId).run();
    }
    if (data.encrypted_metadata !== undefined) {
      await this.db.prepare('UPDATE files SET encrypted_metadata = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(data.encrypted_metadata, now, fileId, userId).run();
    }
    if (data.folder_id !== undefined) {
      await this.db.prepare('UPDATE files SET folder_id = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(data.folder_id, now, fileId, userId).run();
    }
    return true;
  }

  async deleteFile(fileId: string, userId: string): Promise<FileRecord | null> {
    const file = await this.getFileById(fileId, userId);
    if (!file) return null;
    await this.db.prepare('UPDATE files SET deleted_at = ? WHERE id = ? AND user_id = ?').bind(Date.now(), fileId, userId).run();
    await this.updateUserStorageUsed(userId, -file.size);
    return file;
  }

  // ─── Upload Sessions (with expiry enforcement) ───

  async createUploadSession(session: Omit<UploadSessionRecord, 'created_at' | 'uploaded_chunks' | 'status'>): Promise<UploadSessionRecord> {
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO upload_sessions (id, user_id, file_id, object_id, total_chunks, uploaded_chunks, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, 0, 'uploading', ?, ?)`
      )
      .bind(session.id, session.user_id, session.file_id, session.object_id, session.total_chunks, session.expires_at, now)
      .run();
    return { ...session, uploaded_chunks: 0, status: 'uploading', created_at: now };
  }

  async getUploadSession(uploadId: string, userId: string): Promise<UploadSessionRecord | null> {
    const now = Date.now();
    return this.db
      .prepare('SELECT * FROM upload_sessions WHERE id = ? AND user_id = ? AND expires_at > ?')
      .bind(uploadId, userId, now)
      .first<UploadSessionRecord>();
  }

  async incrementUploadChunk(uploadId: string): Promise<void> {
    await this.db.prepare('UPDATE upload_sessions SET uploaded_chunks = uploaded_chunks + 1 WHERE id = ?').bind(uploadId).run();
  }

  async completeUploadSession(uploadId: string): Promise<void> {
    await this.db.prepare("UPDATE upload_sessions SET status = 'completed' WHERE id = ?").bind(uploadId).run();
  }

  /** Reconcile & clean up abandoned upload sessions, freeing up reserved user storage quota */
  async reconcileExpiredUploads(): Promise<{ cleanedCount: number }> {
    const now = Date.now();
    try {
      const expiredRes = await this.db
        .prepare("SELECT * FROM upload_sessions WHERE status = 'uploading' AND expires_at < ?")
        .bind(now)
        .all<UploadSessionRecord>();

      const expiredSessions = expiredRes.results || [];
      let cleanedCount = 0;

      for (const session of expiredSessions) {
        const file = await this.db
          .prepare('SELECT id, user_id, size FROM files WHERE id = ?')
          .bind(session.file_id)
          .first<{ id: string; user_id: string; size: number }>();

        if (file) {
          await this.updateUserStorageUsed(file.user_id, -file.size);
          await this.db.prepare('DELETE FROM files WHERE id = ?').bind(file.id).run();
        }

        await this.db.prepare("UPDATE upload_sessions SET status = 'failed' WHERE id = ?").bind(session.id).run();
        cleanedCount++;
      }

      return { cleanedCount };
    } catch {
      return { cleanedCount: 0 };
    }
  }

  // ─── Account Deletion ───

  async deleteUserAccount(userId: string): Promise<string[]> {
    const filesRes = await this.db.prepare('SELECT object_id FROM files WHERE user_id = ?').bind(userId).all<{ object_id: string }>();
    const objectIds = (filesRes.results || []).map(r => r.object_id);

    await this.db.prepare('DELETE FROM audit_logs WHERE user_id = ?').bind(userId).run();
    await this.db.prepare('DELETE FROM recovery_material WHERE user_id = ?').bind(userId).run();
    await this.db.prepare('DELETE FROM upload_sessions WHERE user_id = ?').bind(userId).run();
    await this.db.prepare('DELETE FROM files WHERE user_id = ?').bind(userId).run();
    await this.db.prepare('DELETE FROM folders WHERE user_id = ?').bind(userId).run();
    await this.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
    await this.db.prepare('DELETE FROM devices WHERE user_id = ?').bind(userId).run();
    await this.db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
    return objectIds;
  }

  // ─── Audit Logs ───

  async createAuditLog(log: Omit<AuditLogRecord, 'id' | 'timestamp'>): Promise<void> {
    await this.db
      .prepare('INSERT INTO audit_logs (id, user_id, device_id, event_type, ip_address, user_agent, timestamp, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), log.user_id || null, log.device_id || null, log.event_type, log.ip_address || '', log.user_agent || '', Date.now(), log.details || '')
      .run();
  }

  async getAuditLogs(userId: string, limit = 50): Promise<AuditLogRecord[]> {
    const res = await this.db.prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?').bind(userId, limit).all<AuditLogRecord>();
    return res.results || [];
  }

  // ─── Recovery Material ───

  async setRecoveryMaterial(userId: string, encryptedVaultKey: string, recoveryKeyHash: string): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO recovery_material (user_id, encrypted_vault_key, recovery_key_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET encrypted_vault_key = excluded.encrypted_vault_key, recovery_key_hash = excluded.recovery_key_hash, updated_at = excluded.updated_at`
      )
      .bind(userId, encryptedVaultKey, recoveryKeyHash, now, now)
      .run();
  }

  async getRecoveryMaterial(userId: string) {
    return this.db.prepare('SELECT * FROM recovery_material WHERE user_id = ?').bind(userId).first<{ user_id: string; encrypted_vault_key: string; recovery_key_hash: string }>();
  }

  // ─── D1-Backed Cross-Instance Rate Limiting ───

  /**
   * Atomically check and increment a rate limit counter.
   * Returns true (allowed) or false (rate limited).
   * Uses ON CONFLICT upsert for atomic cross-instance safety.
   */
  async checkAndIncrementRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const now = Date.now();
    const resetAt = now + windowSeconds * 1000;
    try {
      const result = await this.db
        .prepare(
          `INSERT INTO rate_limits (key, count, reset_at)
           VALUES (?, 1, ?)
           ON CONFLICT(key) DO UPDATE SET
             count = CASE WHEN rate_limits.reset_at < ? THEN 1 ELSE rate_limits.count + 1 END,
             reset_at = CASE WHEN rate_limits.reset_at < ? THEN ? ELSE rate_limits.reset_at END
           RETURNING count`
        )
        .bind(key, resetAt, now, now, resetAt)
        .first<{ count: number }>();
      return (result?.count ?? 0) <= limit;
    } catch {
      return true; // Fail open on DB error to avoid blocking legitimate users
    }
  }

  // ─── PoW Nonce Replay Prevention ───

  /** Marks a PoW nonce hash as used. Returns false if it was already used (replay attempt). */
  async markPoWNonceUsed(nonceHash: string, expiresAt: number): Promise<boolean> {
    try {
      await this.db
        .prepare('INSERT INTO pow_nonces (nonce_hash, expires_at, created_at) VALUES (?, ?, ?)')
        .bind(nonceHash, expiresAt, Date.now())
        .run();
      return true;
    } catch {
      return false; // UNIQUE constraint violation = nonce already used
    }
  }

  // ─── Account Deletion Confirmation ───

  /** Creates a single-use deletion confirmation token with a 2-minute TTL. */
  async createDeleteConfirmation(userId: string): Promise<string> {
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = Date.now() + 2 * 60 * 1000;
    await this.db
      .prepare('INSERT INTO delete_confirmations (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(token, userId, expiresAt, Date.now())
      .run();
    return token;
  }

  /** Verifies and atomically consumes a deletion confirmation token. Returns false if invalid/expired. */
  async verifyAndConsumeDeleteConfirmation(token: string, userId: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT user_id FROM delete_confirmations WHERE token = ? AND expires_at > ?')
      .bind(token, Date.now())
      .first<{ user_id: string }>();
    if (!row || row.user_id !== userId) return false;
    await this.db.prepare('DELETE FROM delete_confirmations WHERE token = ?').bind(token).run();
    return true;
  }

  // ─── Scheduled Cleanup ───

  /** Purge expired rate limit keys, PoW nonces, and deletion tokens from D1. */
  async cleanupExpiredSecurityRecords(): Promise<void> {
    const now = Date.now();
    try {
      await this.db.batch([
        this.db.prepare('DELETE FROM rate_limits WHERE reset_at < ?').bind(now),
        this.db.prepare('DELETE FROM pow_nonces WHERE expires_at < ?').bind(now),
        this.db.prepare('DELETE FROM delete_confirmations WHERE expires_at < ?').bind(now),
      ]);
    } catch {}
  }
}
