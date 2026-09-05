-- Migration: Add persistent trusted_physical_devices table for tracking unique hardware devices per user
-- This table persists across sessions — a device stays registered even when the user logs out.
-- Capped at 3 unique physical devices per account.

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

CREATE INDEX IF NOT EXISTS idx_physical_devices_user ON trusted_physical_devices(user_id);
