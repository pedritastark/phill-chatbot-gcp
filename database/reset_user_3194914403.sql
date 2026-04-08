-- ============================================
-- Script: Reset User Account
-- Usuario: whatsapp:+573194914403
-- Acción: Mantener usuario y contraseña, borrar todos los datos financieros
-- ============================================

BEGIN;

-- 1. Obtener el user_id del usuario
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Buscar el user_id por número de teléfono
    SELECT user_id INTO target_user_id
    FROM users
    WHERE phone_number = 'whatsapp:+573194914403';

    -- Verificar que el usuario existe
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario con teléfono whatsapp:+573194914403 no encontrado';
    END IF;

    RAISE NOTICE 'Usuario encontrado: %', target_user_id;

    -- 2. BORRAR DATOS RELACIONADOS (en orden correcto para evitar errores de FK)

    -- Pagos de deudas
    DELETE FROM debt_payments WHERE user_id = target_user_id;
    RAISE NOTICE 'Pagos de deudas eliminados';

    -- Deudas
    DELETE FROM debts WHERE user_id = target_user_id;
    RAISE NOTICE 'Deudas eliminadas';

    -- Pagos de compras a crédito
    DELETE FROM credit_purchase_payments WHERE user_id = target_user_id;
    RAISE NOTICE 'Pagos de compras a crédito eliminados';

    -- Compras a crédito
    DELETE FROM credit_card_purchases WHERE user_id = target_user_id;
    RAISE NOTICE 'Compras a crédito eliminadas';

    -- Suscripciones
    DELETE FROM subscriptions WHERE user_id = target_user_id;
    RAISE NOTICE 'Suscripciones eliminadas';

    -- Mensajes (se borran automáticamente con conversations, pero por si acaso)
    DELETE FROM messages WHERE user_id = target_user_id;
    RAISE NOTICE 'Mensajes eliminados';

    -- Conversaciones
    DELETE FROM conversations WHERE user_id = target_user_id;
    RAISE NOTICE 'Conversaciones eliminadas';

    -- Recordatorios
    DELETE FROM reminders WHERE user_id = target_user_id;
    RAISE NOTICE 'Recordatorios eliminados';

    -- AI Insights
    DELETE FROM ai_insights WHERE user_id = target_user_id;
    RAISE NOTICE 'AI Insights eliminados';

    -- Presupuestos
    DELETE FROM budgets WHERE user_id = target_user_id;
    RAISE NOTICE 'Presupuestos eliminados';

    -- Metas financieras
    DELETE FROM financial_goals WHERE user_id = target_user_id;
    RAISE NOTICE 'Metas financieras eliminadas';

    -- Transacciones (deben borrarse antes de las cuentas)
    DELETE FROM transactions WHERE user_id = target_user_id;
    RAISE NOTICE 'Transacciones eliminadas';

    -- Categorías personalizadas
    DELETE FROM categories WHERE user_id = target_user_id;
    RAISE NOTICE 'Categorías eliminadas';

    -- Cuentas bancarias
    DELETE FROM accounts WHERE user_id = target_user_id;
    RAISE NOTICE 'Cuentas eliminadas';

    -- Tokens de autenticación
    DELETE FROM auth_tokens WHERE user_id = target_user_id;
    RAISE NOTICE 'Tokens de autenticación eliminados';

    -- 3. RESETEAR USUARIO (mantener phone_number y password, resetear todo lo demás)
    UPDATE users
    SET
        name = NULL,
        email = NULL,

        -- Perfil Financiero
        monthly_income = 0,
        savings_goal = 0,
        financial_literacy = 'beginner',
        primary_goal = NULL,
        risk_tolerance = 'medium',

        -- Preferencias
        language = 'es',
        currency = 'COP',
        timezone = 'America/Bogota',
        notifications_enabled = TRUE,

        -- Metadata
        total_messages = 0,
        total_transactions = 0,
        account_balance = 0,

        -- Auditoría (mantener created_at, actualizar el resto)
        updated_at = CURRENT_TIMESTAMP,
        last_interaction = CURRENT_TIMESTAMP,
        is_active = TRUE,

        -- Onboarding (resetear para que vuelva a hacer onboarding)
        onboarding_step = 'name',
        onboarding_completed = FALSE,
        onboarding_data = '{}',

        -- Features
        privacy_mode = FALSE,
        current_streak = 0,
        last_activity_date = NULL,

        -- Estado de Conversación
        current_action = NULL,
        action_data = NULL

        -- NOTA: phone_number y password NO se modifican
    WHERE user_id = target_user_id;

    RAISE NOTICE 'Usuario reseteado exitosamente. Teléfono y contraseña mantenidos.';
    RAISE NOTICE 'El usuario deberá completar el onboarding nuevamente.';

END $$;

COMMIT;

-- ============================================
-- VERIFICACIÓN: Ver el estado final del usuario
-- ============================================

SELECT
    user_id,
    phone_number,
    name,
    email,
    monthly_income,
    total_messages,
    total_transactions,
    account_balance,
    onboarding_completed,
    onboarding_step,
    created_at,
    updated_at,
    last_interaction
FROM users
WHERE phone_number = 'whatsapp:+573194914403';

-- ============================================
-- VERIFICACIÓN: Contar registros relacionados (deben ser 0)
-- ============================================

SELECT
    'Cuentas' as tabla,
    COUNT(*) as total
FROM accounts
WHERE user_id = (SELECT user_id FROM users WHERE phone_number = 'whatsapp:+573194914403')

UNION ALL

SELECT
    'Transacciones' as tabla,
    COUNT(*) as total
FROM transactions
WHERE user_id = (SELECT user_id FROM users WHERE phone_number = 'whatsapp:+573194914403')

UNION ALL

SELECT
    'Categorías' as tabla,
    COUNT(*) as total
FROM categories
WHERE user_id = (SELECT user_id FROM users WHERE phone_number = 'whatsapp:+573194914403')

UNION ALL

SELECT
    'Metas' as tabla,
    COUNT(*) as total
FROM financial_goals
WHERE user_id = (SELECT user_id FROM users WHERE phone_number = 'whatsapp:+573194914403')

UNION ALL

SELECT
    'Recordatorios' as tabla,
    COUNT(*) as total
FROM reminders
WHERE user_id = (SELECT user_id FROM users WHERE phone_number = 'whatsapp:+573194914403')

UNION ALL

SELECT
    'Conversaciones' as tabla,
    COUNT(*) as total
FROM conversations
WHERE user_id = (SELECT user_id FROM users WHERE phone_number = 'whatsapp:+573194914403')

UNION ALL

SELECT
    'Deudas' as tabla,
    COUNT(*) as total
FROM debts
WHERE user_id = (SELECT user_id FROM users WHERE phone_number = 'whatsapp:+573194914403')

UNION ALL

SELECT
    'Compras a crédito' as tabla,
    COUNT(*) as total
FROM credit_card_purchases
WHERE user_id = (SELECT user_id FROM users WHERE phone_number = 'whatsapp:+573194914403');
