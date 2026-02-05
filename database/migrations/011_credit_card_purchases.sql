-- ============================================
-- Migration: Credit Card Purchases with Installments
-- ============================================
-- Purpose: Enable tracking of credit card purchases with cuotas (installments)
-- Users can register purchases and record monthly payments without needing
-- to know interest rates - just track what they bought and what they pay.

-- ============================================
-- 1. TABLA: credit_card_purchases (Compras a Cuotas)
-- ============================================

CREATE TABLE credit_card_purchases (
    purchase_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    
    -- Purchase info
    description VARCHAR(200) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    installments INTEGER NOT NULL DEFAULT 1,
    installment_amount DECIMAL(12, 2) NOT NULL,
    
    -- Tracking
    paid_installments INTEGER DEFAULT 0,
    remaining_amount DECIMAL(12, 2) NOT NULL,
    total_paid DECIMAL(12, 2) DEFAULT 0,
    
    -- Dates
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    first_payment_date DATE,
    last_payment_date DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_installments CHECK (installments >= 1 AND installments <= 48),
    CONSTRAINT chk_paid_installments CHECK (paid_installments >= 0 AND paid_installments <= installments),
    CONSTRAINT chk_amounts_positive CHECK (total_amount > 0 AND installment_amount > 0),
    CONSTRAINT chk_purchase_status CHECK (status IN ('active', 'paid_off', 'cancelled'))
);

-- Índices
CREATE INDEX idx_credit_purchases_user ON credit_card_purchases(user_id);
CREATE INDEX idx_credit_purchases_account ON credit_card_purchases(account_id);
CREATE INDEX idx_credit_purchases_status ON credit_card_purchases(user_id, status);
CREATE INDEX idx_credit_purchases_date ON credit_card_purchases(purchase_date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_credit_purchases_updated_at BEFORE UPDATE ON credit_card_purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. TABLA: credit_purchase_payments (Pagos de Cuotas)
-- ============================================

CREATE TABLE credit_purchase_payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES credit_card_purchases(purchase_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Payment info
    amount DECIMAL(12, 2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes VARCHAR(200),
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_payment_amount CHECK (amount > 0)
);

-- Índices
CREATE INDEX idx_purchase_payments_purchase ON credit_purchase_payments(purchase_id);
CREATE INDEX idx_purchase_payments_user ON credit_purchase_payments(user_id);
CREATE INDEX idx_purchase_payments_date ON credit_purchase_payments(payment_date DESC);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE credit_card_purchases IS 'Credit card purchases with installment tracking (cuotas)';
COMMENT ON TABLE credit_purchase_payments IS 'Payments made towards credit card purchases';
