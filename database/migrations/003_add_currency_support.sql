-- Description: Add currency support for accounts and transactions
-- Author: Phill AI

-- 1. Add currency column to accounts (default COP)
ALTER TABLE accounts 
ADD COLUMN currency VARCHAR(3) DEFAULT 'COP';

COMMENT ON COLUMN accounts.currency IS 'COP, USD, EUR';

-- 2. Add currency column to transactions (default COP)
ALTER TABLE transactions 
ADD COLUMN currency VARCHAR(3) DEFAULT 'COP';

-- 3. Add check constraint for supported currencies
ALTER TABLE accounts 
ADD CONSTRAINT chk_account_currency CHECK (currency IN ('COP', 'USD', 'EUR'));

ALTER TABLE transactions
ADD CONSTRAINT chk_transaction_currency CHECK (currency IN ('COP', 'USD', 'EUR'));
