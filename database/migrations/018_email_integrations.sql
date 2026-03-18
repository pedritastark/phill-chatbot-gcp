-- Migration: Email Integrations for Automatic Transaction Detection
-- Description: Adds Gmail integration with OAuth2 for automatic expense parsing from bank emails
-- Date: 2026-03-16

BEGIN;

-- 1. Email Integrations Table (OAuth2 configuration per user)
CREATE TABLE IF NOT EXISTS email_integrations (
    integration_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    email_address VARCHAR(255) NOT NULL,
    provider VARCHAR(50) DEFAULT 'gmail' NOT NULL,

    -- OAuth2 Tokens (will be encrypted in production)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,

    -- Sync Configuration
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_message_id VARCHAR(500),  -- Track last processed message ID
    sync_frequency VARCHAR(20) DEFAULT 'half_hourly' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, email_address),
    CONSTRAINT chk_email_provider CHECK (provider IN ('gmail')),
    CONSTRAINT chk_sync_frequency CHECK (sync_frequency IN ('half_hourly', 'hourly', 'daily'))
);

-- 2. Email Transactions Table (Parsed emails pending confirmation)
CREATE TABLE IF NOT EXISTS email_transactions (
    email_transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES email_integrations(integration_id) ON DELETE CASCADE,

    -- Email Details
    email_from VARCHAR(255) NOT NULL,
    email_subject TEXT NOT NULL,
    email_date TIMESTAMP WITH TIME ZONE NOT NULL,
    email_message_id VARCHAR(500) UNIQUE NOT NULL,

    -- Parsed Data (from AI)
    detected_type VARCHAR(20),
    detected_amount DECIMAL(12, 2),
    detected_currency VARCHAR(3) DEFAULT 'COP',
    detected_description TEXT,
    detected_category VARCHAR(100),
    detected_merchant VARCHAR(255),
    confidence_score DECIMAL(3, 2),  -- 0.00 to 1.00

    -- Raw Data (for debugging and reprocessing)
    raw_email_body TEXT,
    raw_email_snippet TEXT,
    extraction_json JSONB,

    -- Processing Status
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    linked_transaction_id UUID REFERENCES transactions(transaction_id) ON DELETE SET NULL,

    -- User Response
    user_confirmed BOOLEAN,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_email_transaction_type CHECK (detected_type IN ('income', 'expense', 'transfer', 'notification', 'unknown')),
    CONSTRAINT chk_email_status CHECK (status IN ('pending', 'confirmed', 'rejected', 'ignored', 'error', 'duplicate'))
);

-- 3. Modify transactions table to track source
DO $$
BEGIN
    -- Add source_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='transactions' AND column_name='source_type'
    ) THEN
        ALTER TABLE transactions
        ADD COLUMN source_type VARCHAR(20) DEFAULT 'manual' NOT NULL;
    END IF;

    -- Add source_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='transactions' AND column_name='source_id'
    ) THEN
        ALTER TABLE transactions
        ADD COLUMN source_id UUID;
    END IF;
END $$;

-- Add constraint for source_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_transaction_source_type'
    ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT chk_transaction_source_type
        CHECK (source_type IN ('manual', 'email', 'api', 'recurring', 'imported'));
    END IF;
END $$;

-- 4. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_email_integrations_user_id ON email_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_email_integrations_active ON email_integrations(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_email_integrations_last_sync ON email_integrations(last_sync_at);

CREATE INDEX IF NOT EXISTS idx_email_transactions_user_id ON email_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_email_transactions_integration_id ON email_transactions(integration_id);
CREATE INDEX IF NOT EXISTS idx_email_transactions_status ON email_transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_email_transactions_message_id ON email_transactions(email_message_id);
CREATE INDEX IF NOT EXISTS idx_email_transactions_date ON email_transactions(email_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(user_id, source_type);
CREATE INDEX IF NOT EXISTS idx_transactions_source_id ON transactions(source_id) WHERE source_id IS NOT NULL;

-- 5. Helper function to get pending email transactions for user
CREATE OR REPLACE FUNCTION get_pending_email_transactions(p_user_id UUID)
RETURNS TABLE(
    email_transaction_id UUID,
    email_from VARCHAR,
    detected_amount DECIMAL,
    detected_description TEXT,
    detected_category VARCHAR,
    email_date TIMESTAMP WITH TIME ZONE,
    confidence_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        et.email_transaction_id,
        et.email_from,
        et.detected_amount,
        et.detected_description,
        et.detected_category,
        et.email_date,
        et.confidence_score
    FROM email_transactions et
    WHERE et.user_id = p_user_id
    AND et.status = 'pending'
    AND et.user_confirmed IS NULL
    ORDER BY et.email_date DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_integrations_updated_at
    BEFORE UPDATE ON email_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_email_integration_timestamp();

CREATE TRIGGER trigger_email_transactions_updated_at
    BEFORE UPDATE ON email_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_email_integration_timestamp();

COMMIT;
