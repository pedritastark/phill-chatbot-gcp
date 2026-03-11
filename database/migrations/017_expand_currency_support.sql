-- Description: Expand supported currencies (align with frontend Settings)
-- Adds MXN, ARS, CLP to existing COP, USD, EUR

ALTER TABLE accounts
DROP CONSTRAINT IF EXISTS chk_account_currency;

ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS chk_transaction_currency;

ALTER TABLE accounts
ADD CONSTRAINT chk_account_currency CHECK (currency IN ('COP', 'USD', 'EUR', 'MXN', 'ARS', 'CLP'));

ALTER TABLE transactions
ADD CONSTRAINT chk_transaction_currency CHECK (currency IN ('COP', 'USD', 'EUR', 'MXN', 'ARS', 'CLP'));

