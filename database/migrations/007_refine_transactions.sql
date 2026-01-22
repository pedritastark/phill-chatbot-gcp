-- Migration: 007_refine_transactions.sql
-- Description: Refactor transactions for financial integrity (Currency & Status)
-- Date: 2026-01-11

BEGIN;

-- 1. Ensure Currency Column (Multi-currency support)
-- Checks if column exists first to avoid errors on repeated runs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='currency') THEN
        ALTER TABLE transactions ADD COLUMN currency VARCHAR(3) DEFAULT 'COP' NOT NULL;
    END IF;
END $$;

-- 2. Ensure Status Column (Transaction lifecycle)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='status') THEN
        ALTER TABLE transactions ADD COLUMN status VARCHAR(20) DEFAULT 'completed' NOT NULL;
    END IF;
END $$;

-- 3. Add Constraints (Safety checks)
DO $$
BEGIN
    -- Status Constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transaction_status') THEN
        ALTER TABLE transactions ADD CONSTRAINT chk_transaction_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));
    END IF;
END $$;

-- 4. Indexes (Performance optimization)
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(user_id, currency);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(user_id, status);

COMMIT;
