-- Migration: Add password authentication support
-- Date: 2026-01-28
-- Description: Adds password_hash column to users table for password-based authentication

-- Add password_hash column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Add index for faster lookups (though we'll primarily use phone_number)
CREATE INDEX IF NOT EXISTS idx_users_password_hash ON users(password_hash) WHERE password_hash IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password for web authentication';
