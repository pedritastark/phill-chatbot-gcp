-- Migration: Email Bank Patterns for Known Colombian Banks
-- Description: Seed patterns for recognized bank email senders to improve filtering
-- Date: 2026-03-16

BEGIN;

-- 1. Bank Patterns Table (Known email senders)
CREATE TABLE IF NOT EXISTS email_bank_patterns (
    pattern_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    bank_name VARCHAR(100) NOT NULL,
    bank_code VARCHAR(50),  -- Optional: internal bank identifier
    email_pattern VARCHAR(255) NOT NULL,  -- SQL LIKE pattern (e.g., '%@bancolombia.com%')
    email_domain VARCHAR(255),  -- Extracted domain for quick filtering

    country VARCHAR(3) DEFAULT 'COL',  -- ISO country code
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,  -- Higher priority = check first (for overlapping patterns)

    -- Pattern Metadata
    pattern_type VARCHAR(20) DEFAULT 'transaction',  -- transaction, statement, alert, notification
    typical_subject_keywords TEXT[],  -- Array of common subject keywords
    notes TEXT,  -- Admin notes about this pattern

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(email_pattern),
    CONSTRAINT chk_pattern_type CHECK (pattern_type IN ('transaction', 'statement', 'alert', 'notification', 'marketing'))
);

-- 2. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_email_bank_patterns_active ON email_bank_patterns(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_email_bank_patterns_country ON email_bank_patterns(country, is_active);
CREATE INDEX IF NOT EXISTS idx_email_bank_patterns_domain ON email_bank_patterns(email_domain);

-- 3. Seed Colombian Bank Patterns
INSERT INTO email_bank_patterns (bank_name, bank_code, email_pattern, email_domain, country, priority, pattern_type, typical_subject_keywords, notes)
VALUES
    -- Major Colombian Banks
    (
        'Bancolombia',
        'BANCOL',
        '%@notificaciones.bancolombia.com%',
        'notificaciones.bancolombia.com',
        'COL',
        10,
        'transaction',
        ARRAY['compra', 'transaccion', 'aprobada', 'rechazada', 'retiro', 'consignacion'],
        'Largest bank in Colombia - primary transaction notification sender'
    ),
    (
        'Bancolombia',
        'BANCOL',
        '%@bancolombia.com%',
        'bancolombia.com',
        'COL',
        9,
        'transaction',
        ARRAY['notificacion', 'alerta', 'movimiento'],
        'Bancolombia - general domain (lower priority than specific subdomain)'
    ),
    (
        'Nequi',
        'NEQUI',
        '%@nequi.com.co%',
        'nequi.com.co',
        'COL',
        10,
        'transaction',
        ARRAY['movimiento', 'recibiste', 'enviaste', 'retiro', 'pago'],
        'Digital wallet by Bancolombia - instant notifications'
    ),
    (
        'Davivienda',
        'DAVIV',
        '%@davivienda.com%',
        'davivienda.com',
        'COL',
        10,
        'transaction',
        ARRAY['transaccion', 'compra', 'aprobada', 'notificacion'],
        'Second largest bank in Colombia'
    ),
    (
        'Banco de Bogotá',
        'BBOG',
        '%@bancodebogota.com%',
        'bancodebogota.com',
        'COL',
        10,
        'transaction',
        ARRAY['notificacion', 'transaccion', 'movimiento'],
        'Major Colombian bank'
    ),
    (
        'BBVA Colombia',
        'BBVA',
        '%@bbva.com.co%',
        'bbva.com.co',
        'COL',
        10,
        'transaction',
        ARRAY['notificacion', 'compra', 'cargo', 'abono'],
        'BBVA Colombia operations'
    ),
    (
        'Banco Popular',
        'BPOP',
        '%@bancopopular.com.co%',
        'bancopopular.com.co',
        'COL',
        10,
        'transaction',
        ARRAY['alerta', 'transaccion', 'notificacion'],
        'Colombian bank'
    ),
    (
        'Banco Occidente',
        'BOCC',
        '%@bancooccidente.com.co%',
        'bancooccidente.com.co',
        'COL',
        10,
        'transaction',
        ARRAY['notificacion', 'movimiento'],
        'Colombian bank'
    ),
    (
        'Banco Caja Social',
        'BCSC',
        '%@cajasocial.com%',
        'cajasocial.com',
        'COL',
        10,
        'transaction',
        ARRAY['transaccion', 'notificacion'],
        'Colombian social bank'
    ),
    (
        'Banco AV Villas',
        'BAVV',
        '%@avvillas.com.co%',
        'avvillas.com.co',
        'COL',
        10,
        'transaction',
        ARRAY['notificacion', 'alerta'],
        'Colombian bank'
    ),
    (
        'Banco Agrario',
        'BAGR',
        '%@bancoagrario.gov.co%',
        'bancoagrario.gov.co',
        'COL',
        10,
        'transaction',
        ARRAY['transaccion', 'notificacion'],
        'Colombian government bank'
    ),

    -- Digital Wallets & Fintechs
    (
        'Daviplata',
        'DAVIP',
        '%@daviplata.com%',
        'daviplata.com',
        'COL',
        10,
        'transaction',
        ARRAY['recibiste', 'enviaste', 'retiro', 'pago'],
        'Digital wallet by Davivienda'
    ),
    (
        'Movii',
        'MOVII',
        '%@movii.com.co%',
        'movii.com.co',
        'COL',
        10,
        'transaction',
        ARRAY['transaccion', 'recarga', 'pago'],
        'Colombian digital wallet'
    ),
    (
        'Rappipay',
        'RAPPI',
        '%@rappipay.co%',
        'rappipay.co',
        'COL',
        10,
        'transaction',
        ARRAY['pago', 'transferencia', 'recarga'],
        'Digital wallet by Rappi'
    ),
    (
        'Ding',
        'DING',
        '%@ding.com.co%',
        'ding.com.co',
        'COL',
        10,
        'transaction',
        ARRAY['transaccion', 'pago'],
        'Colombian fintech'
    ),

    -- Credit Cards (International)
    (
        'Visa',
        'VISA',
        '%visa%alert%',
        NULL,
        'COL',
        8,
        'transaction',
        ARRAY['compra', 'purchase', 'cargo', 'charge'],
        'Visa card alerts - pattern may vary by issuer'
    ),
    (
        'Mastercard',
        'MCARD',
        '%mastercard%',
        NULL,
        'COL',
        8,
        'transaction',
        ARRAY['compra', 'purchase', 'transaction'],
        'Mastercard alerts - pattern may vary by issuer'
    ),

    -- E-commerce & Services
    (
        'PayU',
        'PAYU',
        '%@payu.com%',
        'payu.com',
        'COL',
        7,
        'transaction',
        ARRAY['pago', 'compra', 'transaccion'],
        'Payment gateway used in Colombia'
    ),
    (
        'Mercado Pago',
        'MPAGO',
        '%@mercadopago.com%',
        'mercadopago.com',
        'COL',
        7,
        'transaction',
        ARRAY['pago', 'cobro', 'transferencia'],
        'MercadoLibre payment platform'
    ),
    (
        'Amazon',
        'AMZN',
        '%@amazon.com%',
        'amazon.com',
        'COL',
        5,
        'transaction',
        ARRAY['order', 'pedido', 'compra', 'purchase'],
        'Amazon purchase confirmations'
    ),
    (
        'PayPal',
        'PAYPL',
        '%@paypal.com%',
        'paypal.com',
        'COL',
        7,
        'transaction',
        ARRAY['payment', 'pago', 'sent', 'received'],
        'PayPal transaction notifications'
    );

-- 4. Helper function to find matching bank pattern
CREATE OR REPLACE FUNCTION find_bank_pattern(p_email_from VARCHAR)
RETURNS TABLE(
    pattern_id UUID,
    bank_name VARCHAR,
    bank_code VARCHAR,
    pattern_type VARCHAR,
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bp.pattern_id,
        bp.bank_name,
        bp.bank_code,
        bp.pattern_type,
        bp.priority
    FROM email_bank_patterns bp
    WHERE p_email_from ILIKE bp.email_pattern
    AND bp.is_active = TRUE
    ORDER BY bp.priority DESC, bp.bank_name ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to check if email is from known bank
CREATE OR REPLACE FUNCTION is_financial_email(p_email_from VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    match_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO match_count
    FROM email_bank_patterns
    WHERE p_email_from ILIKE email_pattern
    AND is_active = TRUE;

    RETURN match_count > 0;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_bank_pattern_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bank_patterns_updated_at
    BEFORE UPDATE ON email_bank_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_pattern_timestamp();

COMMIT;
