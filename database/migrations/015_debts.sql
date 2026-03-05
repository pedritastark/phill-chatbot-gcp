-- ============================================
-- Migration: Debt Management (Gestor de Deudas)
-- ============================================
-- Purpose: Enable tracking of debts (credits, mortgages, loans)
-- Users can register debts and record payments that reduce the remaining balance.
-- Includes optional interest rate tracking with principal vs interest breakdown.

-- ============================================
-- 1. TABLA: debts (Deudas)
-- ============================================

CREATE TABLE debts (
    debt_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Debt info
    name VARCHAR(200) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    remaining_amount DECIMAL(12, 2) NOT NULL,
    total_paid DECIMAL(12, 2) DEFAULT 0,

    -- Optional interest info
    interest_rate DECIMAL(6, 4),
    rate_type VARCHAR(20) DEFAULT 'fixed',
    term_months INTEGER,
    monthly_payment DECIMAL(12, 2),
    payment_due_day INTEGER,

    -- Linked account (optional)
    linked_account_id UUID REFERENCES accounts(account_id) ON DELETE SET NULL,

    -- Classification
    category VARCHAR(30) DEFAULT 'other',

    -- Status
    status VARCHAR(20) DEFAULT 'active',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_debt_amounts_positive CHECK (total_amount > 0 AND remaining_amount >= 0),
    CONSTRAINT chk_debt_total_paid CHECK (total_paid >= 0),
    CONSTRAINT chk_debt_due_day CHECK (payment_due_day IS NULL OR (payment_due_day >= 1 AND payment_due_day <= 28)),
    CONSTRAINT chk_debt_rate_type CHECK (rate_type IN ('fixed', 'variable')),
    CONSTRAINT chk_debt_category CHECK (category IN ('credit', 'mortgage', 'car_loan', 'personal_loan', 'other')),
    CONSTRAINT chk_debt_status CHECK (status IN ('active', 'paid_off', 'cancelled'))
);

-- Indices
CREATE INDEX idx_debts_user ON debts(user_id);
CREATE INDEX idx_debts_status ON debts(user_id, status);
CREATE INDEX idx_debts_linked_account ON debts(linked_account_id);

-- Trigger for updated_at
CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. TABLA: debt_payments (Pagos de Deudas)
-- ============================================

CREATE TABLE debt_payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id UUID NOT NULL REFERENCES debts(debt_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Payment info
    amount DECIMAL(12, 2) NOT NULL,
    principal_amount DECIMAL(12, 2),
    interest_amount DECIMAL(12, 2),

    -- Source account
    from_account_id UUID REFERENCES accounts(account_id) ON DELETE SET NULL,

    -- Details
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes VARCHAR(200),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_debt_payment_amount CHECK (amount > 0)
);

-- Indices
CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);
CREATE INDEX idx_debt_payments_user ON debt_payments(user_id);
CREATE INDEX idx_debt_payments_date ON debt_payments(payment_date DESC);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE debts IS 'User debts including credits, mortgages, and loans with optional interest tracking';
COMMENT ON TABLE debt_payments IS 'Payments made towards debts with principal vs interest breakdown';
