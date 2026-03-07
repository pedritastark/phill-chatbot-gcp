-- Migration: Add profile photo field to users table
-- Date: 2026-03-06
-- Description: Adds profile_photo column to store user avatars (base64 or URL)

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;

COMMENT ON COLUMN users.profile_photo IS 'User profile photo (base64 data URL or external URL)';
