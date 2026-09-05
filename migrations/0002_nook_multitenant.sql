-- Nook Multi-Tenant & Quota Migration
-- Migration File: migrations/0002_nook_multitenant.sql

ALTER TABLE users ADD COLUMN storage_used_bytes INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN storage_quota_bytes INTEGER DEFAULT 2147483648; -- 2GB default free quota
ALTER TABLE users ADD COLUMN user_salt TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
