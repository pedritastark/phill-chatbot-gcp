-- ============================================
-- PHILL - Schema de Base de Datos PostgreSQL
-- ============================================
-- Versión: 1.0
-- Descripción: Estructura completa para el chatbot financiero Phill
-- ============================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TABLA: users (Los Usuarios)
-- ============================================
-- Propósito: Tabla central que representa a cada usuario del sistema
-- Llave: phone_number (identificador único desde WhatsApp)

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) UNIQUE NOT NULL, -- Formato: whatsapp:+573218372110
    name VARCHAR(100),
    email VARCHAR(255),
    
    -- Perfil Financiero
    monthly_income DECIMAL(12, 2) DEFAULT 0,
    savings_goal DECIMAL(12, 2) DEFAULT 0,
    financial_literacy VARCHAR(20) DEFAULT 'beginner', -- beginner, intermediate, advanced
    primary_goal VARCHAR(50), -- save, invest, budget, debt
    risk_tolerance VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    
    -- Preferencias
    language VARCHAR(10) DEFAULT 'es', -- es, en
    currency VARCHAR(10) DEFAULT 'COP', -- COP, USD, EUR
    timezone VARCHAR(50) DEFAULT 'America/Bogota',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    total_messages INTEGER DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    account_balance DECIMAL(12, 2) DEFAULT 0,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Onboarding
    onboarding_step VARCHAR(50) DEFAULT 'name', -- name, accounts, completed
    onboarding_completed BOOLEAN DEFAULT FALSE,

    -- Estado de Conversación (Multi-turn)
    current_action VARCHAR(50), -- selecting_account, etc.
    action_data JSONB, -- Datos temporales de la acción
    
    -- Constraints
    CONSTRAINT chk_financial_literacy CHECK (financial_literacy IN ('beginner', 'intermediate', 'advanced')),
    CONSTRAINT chk_risk_tolerance CHECK (risk_tolerance IN ('low', 'medium', 'high')),
    CONSTRAINT chk_primary_goal CHECK (primary_goal IN ('save', 'invest', 'budget', 'debt', 'learn')),
    CONSTRAINT chk_monthly_income CHECK (monthly_income >= 0),
    CONSTRAINT chk_savings_goal CHECK (savings_goal >= 0)
);

-- Índices para optimizar búsquedas
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_last_interaction ON users(last_interaction DESC);

-- ============================================
-- 2. TABLA: accounts (Las Cuentas)
-- ============================================
-- Propósito: Representa las cuentas financieras de cada usuario
-- Pregunta: "¿Dónde está el dinero del usuario?"

CREATE TABLE accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL, -- "Bancolombia Ahorros", "Efectivo"
    type VARCHAR(50) NOT NULL, -- savings, checking, credit_card, cash, investment
    bank_name VARCHAR(100), -- "Bancolombia", "Davivienda"
    
    -- Información financiera
    balance DECIMAL(12, 2) DEFAULT 0,
    credit_limit DECIMAL(12, 2), -- Para tarjetas de crédito
    interest_rate DECIMAL(5, 2), -- Tasa de interés
    
    -- Metadata
    account_number_last4 VARCHAR(4), -- Últimos 4 dígitos (por seguridad)
    color VARCHAR(7) DEFAULT '#6366f1', -- Color para UI (hex)
    icon VARCHAR(50) DEFAULT 'bank', -- Icono para UI
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Constraints
    CONSTRAINT chk_account_type CHECK (type IN ('savings', 'checking', 'credit_card', 'cash', 'investment')),
    CONSTRAINT chk_balance CHECK (balance IS NULL OR balance >= 0),
    CONSTRAINT chk_credit_limit CHECK (credit_limit IS NULL OR credit_limit >= 0)
);

-- Índices
CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_accounts_active ON accounts(user_id, is_active);

-- ============================================
-- 3. TABLA: categories (Las Categorías)
-- ============================================
-- Propósito: Clasifica los movimientos de dinero
-- Pregunta: "¿En qué conceptos se mueve el dinero?"

CREATE TABLE categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL, -- "Comida", "Transporte", "Salario"
    type VARCHAR(20) NOT NULL, -- income, expense
    
    -- Metadata y UI
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1', -- Color hex para UI
    icon VARCHAR(50) DEFAULT 'tag', -- Icono para UI
    
    -- Subcategorías (opcional)
    parent_category_id UUID REFERENCES categories(category_id) ON DELETE SET NULL,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Constraints
    CONSTRAINT chk_category_type CHECK (type IN ('income', 'expense')),
    CONSTRAINT unique_user_category_name UNIQUE(user_id, name, type)
);

-- Índices
CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_categories_type ON categories(user_id, type);
CREATE INDEX idx_categories_parent ON categories(parent_category_id);

-- ============================================
-- 4. TABLA: transactions (Las Transacciones)
-- ============================================
-- Propósito: CORAZÓN DEL SISTEMA - Registra cada movimiento de dinero
-- Pregunta: "¿Qué movimiento de dinero ocurrió?"

CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relaciones (El Pegamento)
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(account_id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(category_id) ON DELETE SET NULL,
    
    -- Información de la transacción
    type VARCHAR(20) NOT NULL, -- income, expense
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    notes TEXT, -- Notas adicionales del usuario
    tags TEXT[], -- Array de tags ["urgente", "recurrente"]
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_frequency VARCHAR(20), -- daily, weekly, monthly, yearly
    
    -- Detección automática
    detected_by_ai BOOLEAN DEFAULT FALSE, -- Si fue detectado por el chatbot
    confidence_score DECIMAL(3, 2), -- Confianza de la IA (0.00 - 1.00)
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete
    
    -- Constraints
    CONSTRAINT chk_transaction_type CHECK (type IN ('income', 'expense')),
    CONSTRAINT chk_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_recurring_frequency CHECK (recurring_frequency IS NULL OR recurring_frequency IN ('daily', 'weekly', 'monthly', 'yearly'))
);

-- Índices (críticos para rendimiento)
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_type ON transactions(user_id, type);
CREATE INDEX idx_transactions_not_deleted ON transactions(user_id, is_deleted) WHERE is_deleted = FALSE;

-- ============================================
-- 5. TABLA: budgets (Los Presupuestos)
-- ============================================
-- Propósito: Define límites de gasto por categoría
-- Pregunta: "¿Cuál es el plan de gastos del usuario?"

CREATE TABLE budgets (
    budget_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relaciones
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    
    -- Configuración del presupuesto
    limit_amount DECIMAL(12, 2) NOT NULL,
    period VARCHAR(20) NOT NULL, -- daily, weekly, monthly, yearly
    
    -- Periodo específico
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- Tracking
    current_spent DECIMAL(12, 2) DEFAULT 0,
    alert_threshold DECIMAL(5, 2) DEFAULT 80.00, -- % para alertar (ej. 80%)
    alert_sent BOOLEAN DEFAULT FALSE,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Constraints
    CONSTRAINT chk_budget_period CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly')),
    CONSTRAINT chk_limit_positive CHECK (limit_amount > 0),
    CONSTRAINT chk_alert_threshold CHECK (alert_threshold >= 0 AND alert_threshold <= 100),
    CONSTRAINT chk_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT unique_user_category_period UNIQUE(user_id, category_id, period, start_date)
);

-- Índices
CREATE INDEX idx_budgets_user ON budgets(user_id);
CREATE INDEX idx_budgets_active ON budgets(user_id, is_active);
CREATE INDEX idx_budgets_period ON budgets(user_id, start_date, end_date);

-- ============================================
-- 6. TABLA: financial_goals (Las Metas Financieras)
-- ============================================
-- Propósito: Representa los objetivos de ahorro del usuario
-- Pregunta: "¿Para qué está ahorrando el usuario?"

CREATE TABLE financial_goals (
    goal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Información de la meta
    name VARCHAR(200) NOT NULL, -- "Viaje a Japón", "Fondo de Emergencia"
    description TEXT,
    target_amount DECIMAL(12, 2) NOT NULL,
    current_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- Fechas
    target_date DATE,
    started_at DATE DEFAULT CURRENT_DATE,
    
    -- Configuración
    priority INTEGER DEFAULT 5, -- 1 (baja) a 10 (alta)
    category VARCHAR(50), -- emergency, travel, investment, purchase, education
    
    -- Metadata y UI
    color VARCHAR(7) DEFAULT '#10b981',
    icon VARCHAR(50) DEFAULT 'target',
    image_url TEXT, -- URL de imagen inspiracional
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- active, completed, cancelled, paused
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_target_amount_positive CHECK (target_amount > 0),
    CONSTRAINT chk_current_amount CHECK (current_amount >= 0),
    CONSTRAINT chk_priority CHECK (priority >= 1 AND priority <= 10),
    CONSTRAINT chk_goal_status CHECK (status IN ('active', 'completed', 'cancelled', 'paused')),
    CONSTRAINT chk_goal_category CHECK (category IN ('emergency', 'travel', 'investment', 'purchase', 'education', 'other'))
);

-- Índices
CREATE INDEX idx_goals_user ON financial_goals(user_id);
CREATE INDEX idx_goals_status ON financial_goals(user_id, status);
CREATE INDEX idx_goals_target_date ON financial_goals(user_id, target_date);

-- ============================================
-- 7. TABLA: conversations (Historial de Conversaciones)
-- ============================================
-- Propósito: Mantiene el contexto de las conversaciones con cada usuario

CREATE TABLE conversations (
    conversation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Información de la conversación
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    
    -- Contexto
    context_summary TEXT, -- Resumen de la conversación generado por IA
    topics TEXT[], -- ["ahorro", "inversión", "presupuesto"]
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_active ON conversations(user_id, is_active);

-- ============================================
-- 8. TABLA: messages (Mensajes de Conversación)
-- ============================================
-- Propósito: Almacena cada mensaje individual de la conversación

CREATE TABLE messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Contenido del mensaje
    role VARCHAR(20) NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    
    -- Metadata
    tokens_used INTEGER, -- Tokens consumidos por este mensaje
    model_used VARCHAR(50), -- "gemini-pro", "gpt-4"
    response_time_ms INTEGER, -- Tiempo de respuesta en milisegundos
    
    -- Detección de intención
    intent VARCHAR(100), -- "register_expense", "ask_balance", "investment_advice"
    entities JSONB, -- Entidades extraídas: {"amount": 50000, "category": "comida"}
    
    -- Feedback
    helpful BOOLEAN, -- Si el usuario marcó como útil
    rating INTEGER, -- Calificación 1-5
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_message_role CHECK (role IN ('user', 'assistant', 'system')),
    CONSTRAINT chk_rating CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

-- Índices
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_user ON messages(user_id, created_at DESC);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_intent ON messages(intent) WHERE intent IS NOT NULL;

-- ============================================
-- 9. TABLA: ai_insights (Insights Generados por IA)
-- ============================================
-- Propósito: Almacena análisis y recomendaciones generadas por la IA

CREATE TABLE ai_insights (
    insight_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Información del insight
    type VARCHAR(50) NOT NULL, -- spending_pattern, saving_tip, budget_alert, investment_opportunity
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    
    -- Datos de soporte
    data JSONB, -- Datos estructurados que respaldan el insight
    confidence_score DECIMAL(3, 2), -- 0.00 - 1.00
    
    -- Estado
    status VARCHAR(20) DEFAULT 'new', -- new, viewed, acted_upon, dismissed
    priority INTEGER DEFAULT 5, -- 1 (baja) a 10 (alta)
    
    -- Interacción del usuario
    viewed_at TIMESTAMP WITH TIME ZONE,
    acted_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE, -- Insights que expiran
    
    -- Constraints
    CONSTRAINT chk_insight_status CHECK (status IN ('new', 'viewed', 'acted_upon', 'dismissed')),
    CONSTRAINT chk_insight_priority CHECK (priority >= 1 AND priority <= 10)
);

-- Índices
CREATE INDEX idx_insights_user ON ai_insights(user_id);
CREATE INDEX idx_insights_status ON ai_insights(user_id, status);
CREATE INDEX idx_insights_priority ON ai_insights(user_id, priority DESC);
CREATE INDEX idx_insights_created ON ai_insights(created_at DESC);

-- ============================================
-- FUNCIONES Y TRIGGERS
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a todas las tablas relevantes
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON financial_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para actualizar el balance de la cuenta
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.type = 'income' THEN
            UPDATE accounts SET balance = balance + NEW.amount WHERE account_id = NEW.account_id;
        ELSIF NEW.type = 'expense' THEN
            UPDATE accounts SET balance = balance - NEW.amount WHERE account_id = NEW.account_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.type = 'income' THEN
            UPDATE accounts SET balance = balance - OLD.amount WHERE account_id = OLD.account_id;
        ELSIF OLD.type = 'expense' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE account_id = OLD.account_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER transaction_update_account_balance
    AFTER INSERT OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- Función para actualizar estadísticas del usuario
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users 
        SET total_transactions = total_transactions + 1,
            last_interaction = CURRENT_TIMESTAMP
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER transaction_update_user_stats
    AFTER INSERT ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_user_stats();

-- ============================================
-- VISTAS ÚTILES
-- ============================================

-- Vista: Resumen financiero por usuario
CREATE OR REPLACE VIEW user_financial_summary AS
SELECT 
    u.user_id,
    u.phone_number,
    u.name,
    COUNT(DISTINCT t.transaction_id) as total_transactions,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as balance,
    COUNT(DISTINCT a.account_id) as total_accounts,
    COUNT(DISTINCT fg.goal_id) as total_goals
FROM users u
LEFT JOIN transactions t ON u.user_id = t.user_id AND t.is_deleted = FALSE
LEFT JOIN accounts a ON u.user_id = a.user_id AND a.is_active = TRUE
LEFT JOIN financial_goals fg ON u.user_id = fg.user_id AND fg.status = 'active'
WHERE u.is_active = TRUE
GROUP BY u.user_id, u.phone_number, u.name;

-- Vista: Gastos por categoría (último mes)
CREATE OR REPLACE VIEW monthly_expenses_by_category AS
SELECT 
    u.user_id,
    u.phone_number,
    c.category_id,
    c.name as category_name,
    COUNT(t.transaction_id) as transaction_count,
    SUM(t.amount) as total_amount,
    AVG(t.amount) as avg_amount
FROM users u
JOIN transactions t ON u.user_id = t.user_id
JOIN categories c ON t.category_id = c.category_id
WHERE t.type = 'expense'
    AND t.is_deleted = FALSE
    AND t.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.user_id, u.phone_number, c.category_id, c.name
ORDER BY total_amount DESC;

-- Vista: Progreso de metas financieras
CREATE OR REPLACE VIEW goals_progress AS
SELECT 
    fg.goal_id,
    fg.user_id,
    u.phone_number,
    fg.name as goal_name,
    fg.target_amount,
    fg.current_amount,
    ROUND((fg.current_amount / NULLIF(fg.target_amount, 0) * 100), 2) as progress_percentage,
    fg.target_date,
    CASE 
        WHEN fg.target_date IS NOT NULL THEN 
            (fg.target_date - CURRENT_DATE)
        ELSE NULL 
    END as days_remaining,
    fg.status
FROM financial_goals fg
JOIN users u ON fg.user_id = u.user_id
WHERE fg.status IN ('active', 'completed');

-- ============================================
-- DATOS DE EJEMPLO (Categorías Predeterminadas)
-- ============================================
-- Estas se pueden insertar cuando un usuario nuevo se registra

COMMENT ON TABLE users IS 'Tabla principal de usuarios del sistema';
COMMENT ON TABLE accounts IS 'Cuentas financieras de los usuarios';
COMMENT ON TABLE categories IS 'Categorías de ingresos y gastos';
COMMENT ON TABLE transactions IS 'Registro de todas las transacciones financieras';
COMMENT ON TABLE budgets IS 'Presupuestos definidos por los usuarios';
COMMENT ON TABLE financial_goals IS 'Metas financieras de ahorro';
COMMENT ON TABLE conversations IS 'Historial de conversaciones con el chatbot';
COMMENT ON TABLE messages IS 'Mensajes individuales de las conversaciones';
COMMENT ON TABLE ai_insights IS 'Insights y recomendaciones generadas por IA';

-- ============================================
-- 10. TABLA: reminders (Recordatorios)
-- ============================================
-- Propósito: Almacenar recordatorios programados por los usuarios

CREATE TABLE reminders (
    reminder_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Contenido
    message TEXT NOT NULL,
    
    -- Programación
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50), -- "daily", "weekly", "monthly", "yearly"
    
    -- Estado
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed, cancelled
    sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_reminder_status CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'))
);

-- Índices
CREATE INDEX idx_reminders_user ON reminders(user_id);
CREATE INDEX idx_reminders_status_scheduled ON reminders(status, scheduled_at);

-- Trigger para updated_at
CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FIN DEL SCHEMA
-- ============================================

