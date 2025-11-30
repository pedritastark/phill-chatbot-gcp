# 🗄️ Base de Datos PostgreSQL - Phill

Documentación completa de la estructura de base de datos del chatbot financiero Phill.

## 📋 Índice

- [Descripción General](#descripción-general)
- [Diagrama de Relaciones](#diagrama-de-relaciones)
- [Tablas](#tablas)
- [Vistas](#vistas)
- [Triggers y Funciones](#triggers-y-funciones)
- [Instalación y Configuración](#instalación-y-configuración)
- [Migración de Datos](#migración-de-datos)

---

## Descripción General

La base de datos de Phill está diseñada para gestionar:

- **Usuarios**: Información de cada persona que usa el bot vía WhatsApp
- **Transacciones**: Registro de ingresos y gastos
- **Categorías**: Clasificación de transacciones
- **Cuentas**: Diferentes cuentas bancarias/efectivo por usuario
- **Conversaciones**: Historial de interacciones con el chatbot
- **Metas Financieras**: Objetivos de ahorro de los usuarios
- **Presupuestos**: Límites de gasto por categoría
- **Insights de IA**: Análisis y recomendaciones generadas

---

## Diagrama de Relaciones

```
┌─────────────┐
│   USERS     │ (Tabla Central)
│ • phone_num │◄──────────┐
│ • name      │           │
│ • profile   │           │
└──────┬──────┘           │
       │                  │
       │ 1:N              │
       ├──────────────────┼──────────────────┐
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐   ┌─────────────┐
│ ACCOUNTS    │    │ CATEGORIES  │   │CONVERSATIONS│
│ • type      │    │ • name      │   │ • messages  │
│ • balance   │    │ • type      │   │ • context   │
└──────┬──────┘    └──────┬──────┘   └─────────────┘
       │                  │
       │ N:1        N:1   │
       │                  │
       └────────┐  ┐──────┘
                ▼  ▼
        ┌──────────────────┐
        │  TRANSACTIONS    │ (Donde ocurre la magia jejejej)
        │  • amount        │
        │  • description   │
        │  • date          │
        └──────────────────┘
                │
                │ 1:N
                ▼
        ┌──────────────────┐
        │    BUDGETS       │
        │  • limit_amount  │
        │  • period        │
        └──────────────────┘
                
                │ 1:N
                ▼
        ┌──────────────────┐
        │ FINANCIAL_GOALS  │
        │  • target_amount │
        │  • progress      │
        └──────────────────┘
```

---

## Tablas

### 1. 👤 `users` - Los Usuarios

**Propósito**: Tabla central. Representa a cada persona que usa el bot.

**Identificador único**: `phone_number` (formato WhatsApp: `whatsapp:+573218372110`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user_id` | UUID | ID único (PK) |
| `phone_number` | VARCHAR(50) | Número de WhatsApp (UNIQUE) |
| `name` | VARCHAR(100) | Nombre del usuario |
| `email` | VARCHAR(255) | Email (opcional) |
| **Perfil Financiero** | | |
| `monthly_income` | DECIMAL(12,2) | Ingreso mensual |
| `savings_goal` | DECIMAL(12,2) | Meta de ahorro |
| `financial_literacy` | VARCHAR(20) | Nivel: beginner, intermediate, advanced |
| `primary_goal` | VARCHAR(50) | Objetivo principal: save, invest, budget, debt, learn |
| `risk_tolerance` | VARCHAR(20) | Tolerancia al riesgo: low, medium, high |
| **Preferencias** | | |
| `language` | VARCHAR(10) | Idioma: es, en |
| `currency` | VARCHAR(10) | Moneda: COP, USD, EUR |
| `timezone` | VARCHAR(50) | Zona horaria |
| `notifications_enabled` | BOOLEAN | Notificaciones activas |
| **Metadata** | | |
| `total_messages` | INTEGER | Total de mensajes enviados |
| `total_transactions` | INTEGER | Total de transacciones |
| `account_balance` | DECIMAL(12,2) | Balance calculado |
| **Auditoría** | | |
| `created_at` | TIMESTAMP | Fecha de registro |
| `updated_at` | TIMESTAMP | Última actualización |
| `last_interaction` | TIMESTAMP | Última interacción |
| `is_active` | BOOLEAN | Usuario activo |

---

### 2. 💳 `accounts` - Las Cuentas

**Propósito**: Representa las cuentas financieras de cada usuario (bancos, efectivo, tarjetas).

**Relación**: Muchas cuentas → Un usuario

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `account_id` | UUID | ID único (PK) |
| `user_id` | UUID | FK → users |
| `name` | VARCHAR(100) | Nombre de la cuenta |
| `type` | VARCHAR(50) | Tipo: savings, checking, credit_card, cash, investment |
| `bank_name` | VARCHAR(100) | Nombre del banco |
| `balance` | DECIMAL(12,2) | Saldo actual |
| `credit_limit` | DECIMAL(12,2) | Límite de crédito (tarjetas) |
| `interest_rate` | DECIMAL(5,2) | Tasa de interés |
| `account_number_last4` | VARCHAR(4) | Últimos 4 dígitos |
| `color` | VARCHAR(7) | Color hex para UI |
| `icon` | VARCHAR(50) | Icono para UI |
| `is_default` | BOOLEAN | Cuenta predeterminada |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última actualización |
| `is_active` | BOOLEAN | Cuenta activa |

---

### 3. 🏷️ `categories` - Las Categorías

**Propósito**: Clasifica los movimientos de dinero (ej: "Comida", "Transporte", "Salario").

**Relación**: Muchas categorías → Un usuario

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `category_id` | UUID | ID único (PK) |
| `user_id` | UUID | FK → users |
| `name` | VARCHAR(100) | Nombre de la categoría |
| `type` | VARCHAR(20) | Tipo: income, expense |
| `description` | TEXT | Descripción |
| `color` | VARCHAR(7) | Color hex para UI |
| `icon` | VARCHAR(50) | Icono/emoji para UI |
| `parent_category_id` | UUID | FK → categories (subcategorías) |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última actualización |
| `is_active` | BOOLEAN | Categoría activa |

**Constraint único**: `(user_id, name, type)` - Un usuario no puede tener dos categorías con el mismo nombre y tipo.

---

### 4. 🧾 `transactions` - Las Transacciones

**Propósito**: **CORAZÓN DEL SISTEMA**. Registra cada movimiento de dinero.

**Relación**: Muchas transacciones → Un usuario, una cuenta, una categoría

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `transaction_id` | UUID | ID único (PK) |
| **Relaciones (El Pegamento)** | | |
| `user_id` | UUID | FK → users (¿Quién?) |
| `account_id` | UUID | FK → accounts (¿De dónde?) |
| `category_id` | UUID | FK → categories (¿En qué?) |
| **Información** | | |
| `type` | VARCHAR(20) | income o expense |
| `amount` | DECIMAL(12,2) | Monto (siempre positivo) |
| `description` | TEXT | Descripción del movimiento |
| `transaction_date` | TIMESTAMP | Fecha de la transacción |
| `notes` | TEXT | Notas adicionales |
| `tags` | TEXT[] | Array de tags |
| **Recurrencia** | | |
| `is_recurring` | BOOLEAN | ¿Es recurrente? |
| `recurring_frequency` | VARCHAR(20) | daily, weekly, monthly, yearly |
| **IA** | | |
| `detected_by_ai` | BOOLEAN | Detectado por el chatbot |
| `confidence_score` | DECIMAL(3,2) | Confianza de la IA (0.00-1.00) |
| **Auditoría** | | |
| `created_at` | TIMESTAMP | Fecha de registro |
| `updated_at` | TIMESTAMP | Última actualización |
| `is_deleted` | BOOLEAN | Soft delete |

**Índices importantes**:
- `(user_id, transaction_date DESC)` - Para consultas rápidas por usuario y fecha
- `(user_id, is_deleted)` - Para filtrar eliminados

---

### 5. 🎯 `budgets` - Los Presupuestos

**Propósito**: Define límites de gasto por categoría.

**Relación**: Un presupuesto → Un usuario, una categoría

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `budget_id` | UUID | ID único (PK) |
| `user_id` | UUID | FK → users |
| `category_id` | UUID | FK → categories |
| `limit_amount` | DECIMAL(12,2) | Límite de gasto |
| `period` | VARCHAR(20) | daily, weekly, monthly, yearly |
| `start_date` | DATE | Inicio del periodo |
| `end_date` | DATE | Fin del periodo |
| `current_spent` | DECIMAL(12,2) | Gasto actual |
| `alert_threshold` | DECIMAL(5,2) | % para alertar (ej: 80%) |
| `alert_sent` | BOOLEAN | ¿Alerta enviada? |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última actualización |
| `is_active` | BOOLEAN | Presupuesto activo |

---

### 6. 🏁 `financial_goals` - Las Metas Financieras

**Propósito**: Representa los objetivos de ahorro del usuario (ej: "Viaje a Japón", "Fondo de Emergencia").

**Relación**: Muchas metas → Un usuario

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `goal_id` | UUID | ID único (PK) |
| `user_id` | UUID | FK → users |
| `name` | VARCHAR(200) | Nombre de la meta |
| `description` | TEXT | Descripción detallada |
| `target_amount` | DECIMAL(12,2) | Monto objetivo |
| `current_amount` | DECIMAL(12,2) | Monto actual ahorrado |
| `target_date` | DATE | Fecha objetivo |
| `started_at` | DATE | Fecha de inicio |
| `priority` | INTEGER | Prioridad (1-10) |
| `category` | VARCHAR(50) | emergency, travel, investment, purchase, education, other |
| `color` | VARCHAR(7) | Color hex para UI |
| `icon` | VARCHAR(50) | Icono para UI |
| `image_url` | TEXT | URL de imagen inspiracional |
| `status` | VARCHAR(20) | active, completed, cancelled, paused |
| `completed_at` | TIMESTAMP | Fecha de completación |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última actualización |

---

### 7. 💬 `conversations` - Historial de Conversaciones

**Propósito**: Mantiene el contexto de las conversaciones con cada usuario.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `conversation_id` | UUID | ID único (PK) |
| `user_id` | UUID | FK → users |
| `started_at` | TIMESTAMP | Inicio de la conversación |
| `last_message_at` | TIMESTAMP | Último mensaje |
| `message_count` | INTEGER | Número de mensajes |
| `context_summary` | TEXT | Resumen generado por IA |
| `topics` | TEXT[] | Tópicos discutidos |
| `is_active` | BOOLEAN | Conversación activa |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última actualización |

---

### 8. 💭 `messages` - Mensajes de Conversación

**Propósito**: Almacena cada mensaje individual de la conversación (usuario y bot).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `message_id` | UUID | ID único (PK) |
| `conversation_id` | UUID | FK → conversations |
| `user_id` | UUID | FK → users |
| `role` | VARCHAR(20) | user, assistant, system |
| `content` | TEXT | Contenido del mensaje |
| **Metadata de IA** | | |
| `tokens_used` | INTEGER | Tokens consumidos |
| `model_used` | VARCHAR(50) | Modelo usado (ej: gemini-pro) |
| `response_time_ms` | INTEGER | Tiempo de respuesta (ms) |
| `intent` | VARCHAR(100) | Intención detectada |
| `entities` | JSONB | Entidades extraídas |
| **Feedback** | | |
| `helpful` | BOOLEAN | ¿Fue útil? |
| `rating` | INTEGER | Calificación (1-5) |
| `created_at` | TIMESTAMP | Fecha de creación |

---

### 9. 💡 `ai_insights` - Insights Generados por IA

**Propósito**: Almacena análisis y recomendaciones generadas automáticamente por la IA.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `insight_id` | UUID | ID único (PK) |
| `user_id` | UUID | FK → users |
| `type` | VARCHAR(50) | spending_pattern, saving_tip, budget_alert, investment_opportunity |
| `title` | VARCHAR(200) | Título del insight |
| `description` | TEXT | Descripción detallada |
| `data` | JSONB | Datos estructurados de soporte |
| `confidence_score` | DECIMAL(3,2) | Confianza (0.00-1.00) |
| `status` | VARCHAR(20) | new, viewed, acted_upon, dismissed |
| `priority` | INTEGER | Prioridad (1-10) |
| `viewed_at` | TIMESTAMP | Fecha de visualización |
| `acted_at` | TIMESTAMP | Fecha de acción |
| `dismissed_at` | TIMESTAMP | Fecha de descarte |
| `created_at` | TIMESTAMP | Fecha de creación |
| `expires_at` | TIMESTAMP | Fecha de expiración |

---

## Vistas

### `user_financial_summary`

Resumen financiero completo de cada usuario.

```sql
SELECT 
  user_id,
  phone_number,
  name,
  total_transactions,
  total_income,
  total_expenses,
  balance,
  total_accounts,
  total_goals
FROM user_financial_summary
WHERE user_id = 'xxx';
```

### `monthly_expenses_by_category`

Gastos agrupados por categoría en el último mes.

```sql
SELECT 
  category_name,
  transaction_count,
  total_amount,
  avg_amount
FROM monthly_expenses_by_category
WHERE user_id = 'xxx'
ORDER BY total_amount DESC;
```

### `goals_progress`

Progreso de las metas financieras.

```sql
SELECT 
  goal_name,
  target_amount,
  current_amount,
  progress_percentage,
  days_remaining
FROM goals_progress
WHERE user_id = 'xxx';
```

---

## Triggers y Funciones

### 1. `update_updated_at_column()`

Actualiza automáticamente el campo `updated_at` en cada UPDATE.

**Tablas afectadas**: users, accounts, categories, transactions, budgets, financial_goals, conversations

### 2. `update_account_balance()`

Actualiza automáticamente el balance de una cuenta cuando se inserta o elimina una transacción.

### 3. `update_user_stats()`

Actualiza automáticamente las estadísticas del usuario (`total_transactions`, `last_interaction`) cuando se crea una transacción.

---

## Instalación y Configuración

### 1. Instalar PostgreSQL

```bash
# macOS (con Homebrew)
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Crear base de datos
createdb phill_db
```

### 2. Configurar Variables de Entorno

Crear archivo `.env`:

```bash
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=phill_db
DB_USER=postgres
DB_PASSWORD=tu_password

# O usar URL completa
DATABASE_URL=postgresql://postgres:password@localhost:5432/phill_db
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Ejecutar Schema

```bash
npm run db:setup
```

Este comando:
- ✅ Verifica la conexión a PostgreSQL
- ✅ Crea todas las tablas
- ✅ Crea índices y constraints
- ✅ Crea triggers y funciones
- ✅ Crea vistas

---

## Migración de Datos

### Migrar desde JSON

Si ya tienes datos en `data/conversations.json` y `data/transactions.json`:

```bash
npm run db:migrate
```

Este script:
- 📱 Lee archivos JSON
- 👤 Crea usuarios
- 💬 Migra conversaciones y mensajes
- 💰 Migra transacciones
- 🏷️ Crea categorías automáticamente
- 💳 Crea cuentas predeterminadas

### Datos de Ejemplo

Para poblar la base de datos con datos de ejemplo:

```bash
npm run db:seed
```

Esto crea:
- 1 usuario de ejemplo
- 5 categorías
- 2 cuentas
- 6 transacciones
- 1 meta financiera
- 1 conversación con mensajes

---

## Consultas Útiles

### Ver usuarios activos

```sql
SELECT phone_number, name, total_messages, last_interaction
FROM users
WHERE is_active = true
ORDER BY last_interaction DESC;
```

### Balance de un usuario

```sql
SELECT * FROM user_financial_summary
WHERE phone_number = 'whatsapp:+573218372110';
```

### Últimas transacciones

```sql
SELECT t.*, c.name as category, a.name as account
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.category_id
LEFT JOIN accounts a ON t.account_id = a.account_id
WHERE t.user_id = (SELECT user_id FROM users WHERE phone_number = 'whatsapp:+573218372110')
  AND t.is_deleted = false
ORDER BY t.transaction_date DESC
LIMIT 10;
```

### Gastos por categoría (último mes)

```sql
SELECT * FROM monthly_expenses_by_category
WHERE phone_number = 'whatsapp:+573218372110'
ORDER BY total_amount DESC;
```

---

## Ventajas de PostgreSQL vs JSON

| Aspecto | JSON | PostgreSQL |
|---------|------|------------|
| **Escalabilidad** | ❌ Limitada | ✅ Miles de usuarios |
| **Búsquedas** | ❌ Lenta | ✅ Rápida (índices) |
| **Relaciones** | ❌ Manual | ✅ Foreign keys |
| **Transacciones** | ❌ No atómicas | ✅ ACID |
| **Consultas complejas** | ❌ Difícil | ✅ SQL potente |
| **Integridad** | ❌ Sin validación | ✅ Constraints |
| **Backup** | ⚠️ Manual | ✅ Herramientas nativas |
| **Analytics** | ❌ Limitado | ✅ Agregaciones, vistas |

---

## Próximos Pasos

1. ✅ Configurar PostgreSQL
2. ✅ Ejecutar `npm run db:setup`
3. ✅ Migrar datos existentes o usar seed
4. ✅ Iniciar el bot: `npm start`
5. 🚀 Escalar a producción

## Soporte

Para más información consulta:
- [Documentación de PostgreSQL](https://www.postgresql.org/docs/)
- [Node.js pg library](https://node-postgres.com/)

---

**¡La migración a PostgreSQL está completa! 🎉**

