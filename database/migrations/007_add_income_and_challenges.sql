-- Migration to add onboarding fields for income and challenges
ALTER TABLE users ADD COLUMN IF NOT EXISTS income_source_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS main_challenge TEXT;
