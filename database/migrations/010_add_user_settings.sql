-- ============================================
-- Migration: 010_add_user_settings
-- Purpose: Add user preferences and settings columns for web dashboard
-- Date: 2026-01-30
-- ============================================

-- Security settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;

-- Notification preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_sms BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_transactions BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_weekly_reports BOOLEAN DEFAULT TRUE;

-- UI preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sound_effects BOOLEAN DEFAULT TRUE;

-- Privacy settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_sharing BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS analytics_enabled BOOLEAN DEFAULT TRUE;

-- Comments
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN users.notification_email IS 'Receive notifications via email';
COMMENT ON COLUMN users.notification_sms IS 'Receive notifications via SMS';
COMMENT ON COLUMN users.notification_transactions IS 'Receive alerts for each transaction';
COMMENT ON COLUMN users.notification_weekly_reports IS 'Receive weekly financial reports';
COMMENT ON COLUMN users.dark_mode IS 'UI dark mode preference';
COMMENT ON COLUMN users.sound_effects IS 'Enable sound effects in the app';
COMMENT ON COLUMN users.data_sharing IS 'Allow sharing data with partners for recommendations';
COMMENT ON COLUMN users.analytics_enabled IS 'Allow usage analytics to improve the app';
