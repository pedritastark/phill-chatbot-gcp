-- Migration: Add currency column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'COP';

