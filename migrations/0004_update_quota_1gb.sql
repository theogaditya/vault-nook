-- Migration 0004: Update storage quota to 1GB (1,073,741,824 bytes) per user
UPDATE users SET storage_quota_bytes = 1073741824 WHERE storage_quota_bytes = 2147483648 OR storage_quota_bytes IS NULL;
