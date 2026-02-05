-- Migration: Create subscriptions table
-- Tracks user plan subscriptions

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('basico', 'premium', 'empresas')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'cancelled', 'expired')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    payment_reference VARCHAR(255),
    amount_paid DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'COP',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, status) -- Only one active subscription per user
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Add subscription check function
CREATE OR REPLACE FUNCTION check_user_subscription(p_user_id INTEGER)
RETURNS TABLE(has_subscription BOOLEAN, plan_type VARCHAR, expires_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TRUE,
        s.plan_type,
        s.expires_at
    FROM subscriptions s
    WHERE s.user_id = p_user_id 
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
