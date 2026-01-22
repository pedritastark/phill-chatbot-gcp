-- ============================================
-- Migration: 008_add_auth_tokens
-- Purpose: Add auth_tokens table for OTP login and JWT sessions
-- ============================================

CREATE TABLE IF NOT EXISTS auth_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- OTP for login
    otp_code VARCHAR(6),
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    otp_attempts INTEGER DEFAULT 0,
    
    -- JWT Session
    refresh_token TEXT,
    refresh_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    device_info JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Status
    is_valid BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_otp_attempts CHECK (otp_attempts <= 5)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_otp ON auth_tokens(user_id, otp_code) WHERE otp_code IS NOT NULL AND is_valid = TRUE;
CREATE INDEX IF NOT EXISTS idx_auth_tokens_refresh ON auth_tokens(refresh_token) WHERE refresh_token IS NOT NULL AND is_valid = TRUE;

-- Trigger for updated_at
CREATE TRIGGER update_auth_tokens_updated_at BEFORE UPDATE ON auth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment
COMMENT ON TABLE auth_tokens IS 'Authentication tokens for web dashboard login (OTP + JWT sessions)';
