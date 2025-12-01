-- Migration: Add action state fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_action VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS action_data JSONB;
