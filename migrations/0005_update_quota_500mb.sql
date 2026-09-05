-- Migration 0005: Update default storage quota to 500MB (524,288,000 bytes) except for exempt user_ae71159c13ca4ba78b0b24ccd827a5b3 (1GB)
UPDATE users SET storage_quota_bytes = 524288000 WHERE id != 'user_ae71159c13ca4ba78b0b24ccd827a5b3';
UPDATE users SET storage_quota_bytes = 1073741824 WHERE id = 'user_ae71159c13ca4ba78b0b24ccd827a5b3';
