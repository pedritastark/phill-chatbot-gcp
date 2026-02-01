# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Phill is a WhatsApp-powered financial assistant chatbot that helps users track expenses, register income, and learn about personal finance. Built with Node.js/Express, it uses OpenAI (GPT-4o) for natural language processing and PostgreSQL for data persistence. The system targets Colombian users and handles Colombian Pesos (COP).

**Key Stack:**
- Backend: Node.js + Express
- AI: OpenAI GPT-4o (via Function Calling)
- Database: PostgreSQL with automatic migrations
- Messaging: Twilio WhatsApp API
- Timezone: America/Bogota (Colombian time)

## Development Commands

```bash
# Install dependencies
npm install

# Development mode (with nodemon + auto-reload)
npm run dev

# Production start (runs migrations first)
npm start

# Database operations
npm run migrate          # Run pending migrations
npm run migrate:status   # Check migration status
npm run migrate:reset    # Reset database (dangerous!)
npm run migrate:seed     # Migrate + seed with test data
npm run seed             # Seed database with sample data

# Testing and utilities
npm run lint             # Run ESLint
node scripts/local_chat.js  # Test chatbot locally without WhatsApp
```

## Environment Configuration

Required environment variables in `.env`:

```bash
# Server
PORT=3001
NODE_ENV=development

# Twilio WhatsApp API
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+14155238886

# OpenAI
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL=gpt-4o-mini  # or gpt-4o

# PostgreSQL
DATABASE_URL=postgresql://user:password@host:port/dbname

# JWT (for web dashboard authentication)
JWT_SECRET=your_secret_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# CORS (for web dashboard)
CORS_ORIGINS=https://phill-webpage.vercel.app,http://localhost:5173

# Optional
ADMIN_PHONE_NUMBER=+573218372110
MESSAGE_MAX_LENGTH=1024
DAILY_MESSAGE_LIMIT=50
```

## Architecture

### High-Level Flow

```
User (WhatsApp) → Twilio → Webhook Controller → Message Service
                                                        ↓
                                          ┌─────────────┴─────────────┐
                                          ↓                           ↓
                                    AI Service                  Finance Service
                                (OpenAI Function Calling)    (Transaction CRUD)
                                          ↓                           ↓
                                          └─────────────┬─────────────┘
                                                        ↓
                                                  Database (PostgreSQL)
                                                        ↓
                                                  Response → Twilio → User
```

### Service Layer Architecture

The application is organized into three main service layers:

#### 1. **Message Processing** (`src/services/message.service.js`)

Central orchestrator that:
- Receives messages from webhook controller
- Detects user intent (financial command vs general question)
- Manages conversation context
- Coordinates between AI and Finance services
- Handles onboarding flow for new users

**Key responsibility:** Route messages to appropriate service based on intent.

#### 2. **AI Service** (`src/services/ai.service.js`)

Handles all OpenAI interactions using Function Calling:
- Maintains system prompt defining Phill's personality
- Declares available functions (tools) for OpenAI to call
- Interprets function calls from OpenAI responses
- Generates educational financial responses
- **Never gives specific investment advice**, only educates

**Function Calling Tools:**
- `registrar_gasto` - Expense registration
- `registrar_ingreso` - Income registration
- `obtener_resumen_financiero` - Get financial summary
- `crear_meta_ahorro` - Create savings goal
- `añadir_deposito_meta` - Add deposit to goal

#### 3. **Finance Service** (`src/services/finance.service.js`)

Core financial logic:
- Transaction CRUD operations
- Automatic categorization (based on keywords)
- Financial summary generation (income, expenses, balance)
- Account management (asking user which account to use when not specified)
- Goal tracking with deposit management

**Key feature:** Calculates real balance from sum of all account balances, not just (income - expenses).

### Database Services (`src/services/db/`)

Each database entity has its own service module:
- `user.db.service.js` - User management
- `transaction.db.service.js` - Transaction CRUD
- `account.db.service.js` - Bank accounts/wallets
- `category.db.service.js` - Category management
- `conversation.db.service.js` - Chat history
- `auth.db.service.js` - OTP and JWT tokens for web dashboard

All DB services use pooled connections from `src/config/database.js`.

### Database Schema

PostgreSQL with the following key tables:

**Core Tables:**
- `users` - User profiles (identified by WhatsApp phone number)
- `accounts` - Bank accounts, credit cards, cash, wallets per user
- `transactions` - All financial movements (expenses/income)
- `categories` - Expense/income classification (user-specific + defaults)
- `financial_goals` - Savings goals with target amounts and dates
- `conversations` - Chat history for context
- `messages` - Individual messages with AI metadata
- `reminders` - Scheduled financial reminders

**Authentication (for web dashboard):**
- `otp_codes` - One-time passwords sent via WhatsApp
- `refresh_tokens` - JWT refresh tokens

**Key Relationships:**
- User → many Accounts (1:N)
- User → many Transactions (1:N)
- Account → many Transactions (1:N)
- Category → many Transactions (1:N)
- User → many Goals (1:N)

**Important:** Schema is managed through migrations in `database/migrations/`. See `DATABASE.md` for complete schema documentation.

### REST API for Web Dashboard

Base path: `/api/v1`

**Public Endpoints:**
- `POST /auth/request-otp` - Request OTP via WhatsApp
- `POST /auth/verify-otp` - Verify OTP, returns JWT tokens
- `POST /auth/refresh` - Refresh access token

**Protected Endpoints (require JWT):**
- `GET /me` - User profile
- `PUT /me` - Update profile
- `GET /summary` - Financial dashboard (KPIs)
- `GET /transactions` - List transactions (with filtering)
- `POST /transactions` - Create transaction
- `PUT /transactions/:id` - Update transaction
- `DELETE /transactions/:id` - Delete transaction
- `GET /accounts` - List accounts with balances
- `POST /accounts` - Create account
- `GET /categories` - List categories
- `GET /goals` - List savings goals
- `POST /goals` - Create goal
- `POST /goals/:id/deposit` - Add deposit to goal

**Authentication:** Uses JWT with access tokens (15min) and refresh tokens (30 days). Middleware: `src/middlewares/auth.middleware.js`.

### WhatsApp Message Flow

1. User sends WhatsApp message
2. Twilio webhook hits `POST /webhook`
3. `webhook.controller.js` validates and extracts message
4. `message.service.js` processes:
   - Checks if user is onboarding (first-time setup)
   - Detects if message contains financial command
   - Routes to AI or Finance service
5. Response sent back via Twilio

**Rate Limiting:** 2-second window between messages, 50 messages/day per user (configurable).

### Onboarding Flow

New users go through multi-step onboarding via `onboarding.service.js`:
1. Welcome + name collection
2. Monthly income question
3. Primary financial goal selection
4. Create default categories and accounts
5. Mark as `onboarding_completed = true`

State machine tracked in `user_action_state` field.

## Data Handling Conventions

**Currency:**
- All amounts stored as `DECIMAL(12,2)` in database
- Colombian Pesos (COP) - no decimal currency in practice
- Format: `$1.500.000` (using periods as thousands separator)

**Dates:**
- Database: UTC timestamps (`TIMESTAMP WITH TIME ZONE`)
- Application: Converted to `America/Bogota` timezone
- Use `moment-timezone` or `luxon` for date operations

**Phone Numbers:**
- Format: `whatsapp:+573001234567` (Twilio format)
- Country code required

**Transaction Types:**
- `income` - Money coming in
- `expense` - Money going out

## Testing and Debugging

### Local Chat Testing

Test AI responses without WhatsApp:

```bash
node scripts/local_chat.js
```

This simulates conversations locally using OpenAI directly.

### Database Testing

```bash
# Seed with test data
npm run seed

# Check migration status
npm run migrate:status

# Reset and reseed (CAUTION: deletes all data)
npm run migrate:reset && npm run migrate:seed
```

### Logging System

Uses emoji-based logging (`src/utils/logger.js`):
- 📥 Request received
- 👤 User action
- 📨 Message
- 🤖 AI/OpenAI interaction
- 💰 Finance operation
- ✅ Success
- ⚠️ Warning
- ❌ Error

## Important Development Notes

**OpenAI Function Calling:**
- The AI service declares available tools in `ai.service.js`
- OpenAI decides when to call functions based on user intent
- Function responses are fed back to OpenAI for natural language generation
- Always validate function parameters before executing

**Transaction Registration:**
- If user doesn't specify account, system asks via WhatsApp
- User responds with account selection
- State tracked in conversation context
- Use `finance.service.js → selectAccountForPendingTransaction()`

**Category Auto-detection:**
- Keywords matched in `src/services/categorizer/` (if exists) or directly in finance service
- Falls back to "otros" (other) if no match
- Users can create custom categories

**Balance Calculation:**
- Real balance = SUM of all account balances
- NOT just (total income - total expenses)
- Accounts must be updated when transactions are created

**Message Length Limits:**
- WhatsApp Business API: 1024 characters max
- Configured safety margin: 50 chars
- Recommended length: 700 chars (for cost optimization)
- Auto-split enabled by default

## Deployment

**Production Setup:**
- Deployed on Railway (see `RAILWAY.md`)
- Environment variable `DATABASE_URL` required
- Automatic migrations run on `npm start`
- Health check endpoint: `GET /health`

**Database Migrations:**
- Migration files in `database/migrations/`
- Naming: `XXX_description.sql` (sequential numbers)
- Automatically tracked in `schema_migrations` table
- Always test migrations in development first

## Integration with Frontend

This backend integrates with the `phill-webpage` React frontend:
- Frontend uses JWT authentication via OTP
- All API responses follow format: `{ success: true, data: {...} }`
- Error format: `{ success: false, error: "message" }`
- CORS configured for Vercel deployment + local development

See `phill-webpage/INTEGRATION_PLAN.md` for full integration details.
