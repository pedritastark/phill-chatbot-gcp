-- ============================================
-- 13. LINK CREDIT PURCHASES WITH TRANSACTIONS
-- ============================================

ALTER TABLE credit_card_purchases
ADD COLUMN linked_transaction_id UUID REFERENCES transactions(transaction_id) ON DELETE SET NULL;

ALTER TABLE credit_purchase_payments
ADD COLUMN linked_transaction_id UUID REFERENCES transactions(transaction_id) ON DELETE SET NULL;
