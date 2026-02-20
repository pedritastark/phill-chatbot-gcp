-- ============================================
-- 14. ADD CREDIT CARD CYCLE DAYS
-- ============================================

ALTER TABLE accounts
ADD COLUMN statement_day INTEGER,
ADD COLUMN due_day INTEGER;

ALTER TABLE accounts
ADD CONSTRAINT chk_statement_day CHECK (statement_day IS NULL OR (statement_day BETWEEN 1 AND 28));

ALTER TABLE accounts
ADD CONSTRAINT chk_due_day CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 28));
