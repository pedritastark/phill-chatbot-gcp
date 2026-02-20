-- ============================================
-- 11. EXTENSION: metadata para recordatorios
-- ============================================

ALTER TABLE reminders
ADD COLUMN amount DECIMAL(12,2) DEFAULT 0 NOT NULL,
ADD COLUMN currency VARCHAR(3) DEFAULT 'COP' NOT NULL,
ADD COLUMN account_name TEXT,
ADD COLUMN account_id UUID REFERENCES accounts(account_id) ON DELETE SET NULL,
ADD COLUMN transaction_type VARCHAR(15) DEFAULT 'expense' NOT NULL,
ADD COLUMN completion_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN linked_transaction_id UUID REFERENCES transactions(transaction_id) ON DELETE SET NULL;

ALTER TABLE reminders
ADD CONSTRAINT chk_reminder_transaction_type CHECK (transaction_type IN ('expense', 'income'));

ALTER TABLE reminders
ADD CONSTRAINT chk_reminder_completion_status CHECK (completion_status IN ('pending', 'completed'));
