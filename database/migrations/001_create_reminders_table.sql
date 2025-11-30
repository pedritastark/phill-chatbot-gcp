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
