-- Migration: Add Onboarding Enhancements
-- Description: Adds goal levels, diagnosis storage, and new account types for liabilities.

-- 1. Add new account types for liabilities if not present
ALTER TABLE accounts DROP CONSTRAINT chk_account_type;
ALTER TABLE accounts ADD CONSTRAINT chk_account_type CHECK (type IN ('savings', 'checking', 'credit_card', 'cash', 'investment', 'loan', 'debt'));

-- 2. Add Onboarding Enhancements to Users Table
ALTER TABLE users ADD COLUMN IF NOT EXISTS financial_goal_level INTEGER DEFAULT 1; -- 1: Security, 2: Growth, 3: Legacy
ALTER TABLE users ADD CONSTRAINT chk_financial_goal_level CHECK (financial_goal_level IN (1, 2, 3));

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_rating INTEGER;
ALTER TABLE users ADD CONSTRAINT chk_onboarding_rating CHECK (onboarding_rating >= 1 AND onboarding_rating <= 5);

-- 3. Ensure risk_tolerance has 'conservative', 'moderate', 'aggressive' (already check constraint exists but values might differ)
-- Current schema says: CHECK (risk_tolerance IN ('low', 'medium', 'high'))
-- We want to map: low -> conservative, medium -> moderate, high -> aggressive
-- Or just update the constraint to allow the new terminology.

ALTER TABLE users DROP CONSTRAINT chk_risk_tolerance;
ALTER TABLE users ADD CONSTRAINT chk_risk_tolerance CHECK (risk_tolerance IN ('low', 'medium', 'high', 'conservative', 'moderate', 'aggressive'));

-- 4. Add diagnosis column
ALTER TABLE users ADD COLUMN IF NOT EXISTS financial_diagnosis TEXT;
