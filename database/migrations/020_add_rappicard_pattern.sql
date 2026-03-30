-- Migration: Add RappiCard Email Pattern
-- Description: Add support for RappiCard credit card notifications
-- Date: 2026-03-30

BEGIN;

-- Add RappiCard pattern (credit card, separate from Rappipay wallet)
INSERT INTO email_bank_patterns (
    bank_name,
    bank_code,
    email_pattern,
    email_domain,
    country,
    priority,
    pattern_type,
    typical_subject_keywords,
    notes
)
VALUES
    (
        'RappiCard',
        'RCARD',
        '%@rappicard.co%',
        'rappicard.co',
        'COL',
        10,
        'transaction',
        ARRAY['compra', 'transaccion', 'pago', 'cargo', 'cuota', 'credito'],
        'Rappi credit card - transaction notifications from noreply@rappicard.co'
    )
ON CONFLICT (email_pattern) DO NOTHING;

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Added RappiCard email pattern: %%@rappicard.co%%';
END $$;

COMMIT;
