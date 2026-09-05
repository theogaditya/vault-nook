-- Security Hardening Migration
-- Migration File: migrations/0003_security_hardening.sql
-- Adds: D1-backed rate limiting, PoW nonce replay prevention, account deletion confirmations

-- D1-backed cross-instance rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 1,
  reset_at INTEGER NOT NULL
);

-- PoW nonce replay prevention (marks solved challenges as consumed)
CREATE TABLE IF NOT EXISTS pow_nonces (
  nonce_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Two-step account deletion confirmation tokens
CREATE TABLE IF NOT EXISTS delete_confirmations (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);
CREATE INDEX IF NOT EXISTS idx_pow_nonces_expires ON pow_nonces(expires_at);
CREATE INDEX IF NOT EXISTS idx_delete_confirmations_user ON delete_confirmations(user_id);
