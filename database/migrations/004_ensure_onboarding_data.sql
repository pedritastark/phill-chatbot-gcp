-- Migration: Ensure onboarding_data exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';
