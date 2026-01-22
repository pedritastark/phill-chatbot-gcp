const {
    UserDBService,
    AuthDBService,
    TransactionDBService,
    AccountDBService,
    CategoryDBService
} = require('../services/db');
const FinanceService = require('../services/finance.service');
const WhatsAppService = require('../services/whatsapp.service');
const Logger = require('../utils/logger');
const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken
} = require('../middlewares/auth.middleware');

/**
 * API Controller for Web Dashboard
 * Handles all REST API endpoints
 */
class ApiController {
    // ==========================================
    // AUTH ENDPOINTS
    // ==========================================

    /**
     * POST /api/v1/auth/request-otp
     * Request an OTP code sent via WhatsApp
     */
    async requestOTP(req, res) {
        try {
            const { phone } = req.body;

            if (!phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Número de teléfono requerido'
                });
            }

            // Normalize phone number to WhatsApp format
            let normalizedPhone = phone.trim().replace(/\s+/g, '');
            if (!normalizedPhone.startsWith('+')) {
                // Assume Colombian number if no country code
                normalizedPhone = '+57' + normalizedPhone.replace(/^0/, '');
            }
            const whatsappFormat = `whatsapp:${normalizedPhone}`;

            // Find or create user
            const user = await UserDBService.findOrCreate({ phoneNumber: whatsappFormat });

            // Check rate limiting (max 3 OTPs per hour)
            const attempts = await AuthDBService.getRemainingAttempts(user.user_id);
            if (attempts <= 0) {
                return res.status(429).json({
                    success: false,
                    error: 'Demasiados intentos. Intenta en unos minutos.',
                    code: 'RATE_LIMITED'
                });
            }

            // Create OTP
            const authToken = await AuthDBService.createOTP(user.user_id, {
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            // Send OTP via WhatsApp
            const otpMessage = `🔐 Tu código de acceso a Phill es: *${authToken.otp_code}*\n\nExpira en 5 minutos. No compartas este código con nadie.`;

            await WhatsAppService.sendMessage(whatsappFormat, otpMessage);

            // SPECIAL CASE: Log OTP for demo user or development environment
            if (normalizedPhone === '+573001234567' || process.env.NODE_ENV !== 'production') {
                Logger.info(`🔐 OTP para ${normalizedPhone}: ${authToken.otp_code}`);
            }

            Logger.info(`📱 OTP enviado a ${normalizedPhone}`);

            return res.status(200).json({
                success: true,
                message: 'Código enviado por WhatsApp',
                phone: normalizedPhone.slice(0, -4) + '****' // Masked phone
            });

        } catch (error) {
            Logger.error('Error en requestOTP', error);
            return res.status(500).json({
                success: false,
                error: 'Error al enviar código'
            });
        }
    }

    /**
     * POST /api/v1/auth/verify-otp
     * Verify OTP and return JWT tokens
     */
    async verifyOTP(req, res) {
        try {
            const { phone, code } = req.body;

            if (!phone || !code) {
                return res.status(400).json({
                    success: false,
                    error: 'Teléfono y código requeridos'
                });
            }

            // Normalize phone
            let normalizedPhone = phone.trim().replace(/\s+/g, '');
            if (!normalizedPhone.startsWith('+')) {
                normalizedPhone = '+57' + normalizedPhone.replace(/^0/, '');
            }
            const whatsappFormat = `whatsapp:${normalizedPhone}`;

            // Find user
            const user = await UserDBService.findByPhoneNumber(whatsappFormat);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
            }

            // Verify OTP
            const authToken = await AuthDBService.verifyOTP(user.user_id, code);
            if (!authToken) {
                const remaining = await AuthDBService.getRemainingAttempts(user.user_id);
                return res.status(401).json({
                    success: false,
                    error: 'Código incorrecto o expirado',
                    remainingAttempts: remaining
                });
            }

            // Generate tokens
            const accessToken = generateAccessToken(user, authToken.token_id);
            const refreshToken = generateRefreshToken(user, authToken.token_id);

            // Store refresh token
            await AuthDBService.storeRefreshToken(authToken.token_id, refreshToken);

            Logger.success(`✅ Login exitoso: ${normalizedPhone}`);

            return res.status(200).json({
                success: true,
                accessToken,
                refreshToken,
                user: {
                    id: user.user_id,
                    name: user.name,
                    phone: normalizedPhone,
                    currency: user.currency,
                    onboardingCompleted: user.onboarding_completed
                }
            });

        } catch (error) {
            Logger.error('Error en verifyOTP', error);
            return res.status(500).json({
                success: false,
                error: 'Error al verificar código'
            });
        }
    }

    /**
     * POST /api/v1/auth/refresh
     * Refresh access token using refresh token
     */
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    error: 'Refresh token requerido'
                });
            }

            // Verify refresh token JWT
            const decoded = verifyRefreshToken(refreshToken);
            if (!decoded) {
                return res.status(401).json({
                    success: false,
                    error: 'Refresh token inválido',
                    code: 'INVALID_REFRESH_TOKEN'
                });
            }

            // Find session in database
            const session = await AuthDBService.findByRefreshToken(refreshToken);
            if (!session) {
                return res.status(401).json({
                    success: false,
                    error: 'Sesión expirada o inválida',
                    code: 'SESSION_EXPIRED'
                });
            }

            // Get user
            const user = await UserDBService.findById(session.user_id);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
            }

            // Generate new access token
            const newAccessToken = generateAccessToken(user, session.token_id);

            return res.status(200).json({
                success: true,
                accessToken: newAccessToken
            });

        } catch (error) {
            Logger.error('Error en refreshToken', error);
            return res.status(500).json({
                success: false,
                error: 'Error al renovar token'
            });
        }
    }

    /**
     * POST /api/v1/auth/logout
     * Invalidate session
     */
    async logout(req, res) {
        try {
            if (req.tokenId) {
                await AuthDBService.invalidateSession(req.tokenId);
            }

            return res.status(200).json({
                success: true,
                message: 'Sesión cerrada'
            });

        } catch (error) {
            Logger.error('Error en logout', error);
            return res.status(500).json({
                success: false,
                error: 'Error al cerrar sesión'
            });
        }
    }

    // ==========================================
    // USER ENDPOINTS
    // ==========================================

    /**
     * GET /api/v1/me
     * Get current user profile
     */
    async getProfile(req, res) {
        try {
            const user = req.user;

            return res.status(200).json({
                success: true,
                user: {
                    id: user.user_id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone_number.replace('whatsapp:', ''),
                    currency: user.currency,
                    language: user.language,
                    timezone: user.timezone,
                    monthlyIncome: parseFloat(user.monthly_income) || 0,
                    savingsGoal: parseFloat(user.savings_goal) || 0,
                    financialLiteracy: user.financial_literacy,
                    primaryGoal: user.primary_goal,
                    riskTolerance: user.risk_tolerance,
                    currentStreak: user.current_streak || 0,
                    totalTransactions: user.total_transactions || 0,
                    onboardingCompleted: user.onboarding_completed,
                    createdAt: user.created_at
                }
            });

        } catch (error) {
            Logger.error('Error en getProfile', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener perfil'
            });
        }
    }

    /**
     * PUT /api/v1/me
     * Update current user profile
     */
    async updateProfile(req, res) {
        try {
            const user = req.user;
            const updateData = req.body;

            const updatedUser = await UserDBService.updateProfile(user.user_id, updateData);

            return res.status(200).json({
                success: true,
                user: {
                    id: updatedUser.user_id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    currency: updatedUser.currency,
                    language: updatedUser.language
                }
            });

        } catch (error) {
            Logger.error('Error en updateProfile', error);
            return res.status(500).json({
                success: false,
                error: 'Error al actualizar perfil'
            });
        }
    }

    // ==========================================
    // DASHBOARD ENDPOINTS
    // ==========================================

    /**
     * GET /api/v1/summary
     * Get dashboard KPIs (balance, income, expenses)
     */
    async getSummary(req, res) {
        try {
            const user = req.user;
            const { days = 30 } = req.query;

            const summary = await FinanceService.getUserSummary(user.phone_number, parseInt(days));

            if (!summary) {
                return res.status(200).json({
                    success: true,
                    summary: {
                        totalIncome: 0,
                        totalExpenses: 0,
                        balance: 0,
                        transactionCount: 0,
                        period: `últimos ${days} días`
                    }
                });
            }

            return res.status(200).json({
                success: true,
                summary: {
                    totalIncome: summary.totalIncome,
                    totalExpenses: summary.totalExpenses,
                    balance: summary.balance,
                    transactionCount: summary.transactionCount,
                    avgExpense: summary.avgExpense,
                    avgIncome: summary.avgIncome,
                    period: summary.period
                }
            });

        } catch (error) {
            Logger.error('Error en getSummary', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener resumen'
            });
        }
    }

    // ==========================================
    // TRANSACTION ENDPOINTS
    // ==========================================

    /**
     * GET /api/v1/transactions
     * Get user transactions with pagination and filters
     */
    async getTransactions(req, res) {
        try {
            const user = req.user;
            const {
                page = 1,
                limit = 20,
                type,
                category,
                startDate,
                endDate,
                search
            } = req.query;

            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Build filters
            const filters = {
                limit: parseInt(limit),
                offset
            };

            if (type) filters.type = type;
            if (startDate) filters.startDate = new Date(startDate);
            if (endDate) filters.endDate = new Date(endDate);

            let transactions;
            if (search) {
                transactions = await FinanceService.searchTransactions(user.phone_number, search);
            } else {
                transactions = await FinanceService.getUserTransactions(user.phone_number, filters);
            }

            // Transform to frontend format
            const formattedTransactions = transactions.map(t => ({
                id: t.transaction_id,
                type: t.type,
                amount: parseFloat(t.amount),
                description: t.description,
                category: t.category_name || t.category || 'Sin categoría',
                categoryIcon: t.category_icon || t.icon || '💰',
                categoryColor: t.category_color || t.color || '#6366f1',
                accountId: t.account_id,
                accountName: t.account_name || 'Sin cuenta',
                date: t.transaction_date || t.created_at,
                isRecurring: t.is_recurring || false,
                notes: t.notes,
                currency: t.currency || 'COP',
                status: t.status || 'completed',
                createdAt: t.created_at
            }));

            return res.status(200).json({
                success: true,
                transactions: formattedTransactions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: formattedTransactions.length
                }
            });

        } catch (error) {
            Logger.error('Error en getTransactions', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener transacciones'
            });
        }
    }

    /**
     * POST /api/v1/transactions
     * Create a new transaction
     */
    async createTransaction(req, res) {
        try {
            const user = req.user;
            const {
                type,
                amount,
                description,
                category,
                accountId,
                accountName,
                date,
                notes,
                currency = 'COP',
                status = 'completed'
            } = req.body;

            if (!type || !amount || !description) {
                return res.status(400).json({
                    success: false,
                    error: 'Tipo, monto y descripción son requeridos'
                });
            }

            if (!['income', 'expense'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Tipo debe ser "income" o "expense"'
                });
            }

            const transaction = await FinanceService.createTransaction(
                user.phone_number,
                type,
                parseFloat(amount),
                description,
                category || null,
                accountName || null,
                currency,
                status
            );

            return res.status(201).json({
                success: true,
                transaction: {
                    id: transaction.transaction_id,
                    type: transaction.type,
                    amount: parseFloat(transaction.amount),
                    description: transaction.description,
                    category: transaction.category_name,
                    categoryIcon: transaction.category_icon,
                    accountName: transaction.account_name,
                    date: transaction.transaction_date || transaction.created_at,
                    streakInfo: transaction.streak_info
                }
            });

        } catch (error) {
            Logger.error('Error en createTransaction', error);
            return res.status(500).json({
                success: false,
                error: 'Error al crear transacción'
            });
        }
    }

    /**
     * PUT /api/v1/transactions/:id
     * Update a transaction
     */
    async updateTransaction(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const updateData = req.body;

            // Verify ownership (transaction belongs to user)
            const transactions = await FinanceService.getUserTransactions(user.phone_number, {});
            const transaction = transactions.find(t => t.transaction_id === id);

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    error: 'Transacción no encontrada'
                });
            }

            const updated = await FinanceService.updateTransaction(id, updateData);

            return res.status(200).json({
                success: true,
                transaction: updated
            });

        } catch (error) {
            Logger.error('Error en updateTransaction', error);
            return res.status(500).json({
                success: false,
                error: 'Error al actualizar transacción'
            });
        }
    }

    /**
     * DELETE /api/v1/transactions/:id
     * Delete a transaction (soft delete)
     */
    async deleteTransaction(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;

            // Verify ownership
            const transactions = await FinanceService.getUserTransactions(user.phone_number, {});
            const transaction = transactions.find(t => t.transaction_id === id);

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    error: 'Transacción no encontrada'
                });
            }

            await FinanceService.deleteTransaction(id);

            return res.status(200).json({
                success: true,
                message: 'Transacción eliminada'
            });

        } catch (error) {
            Logger.error('Error en deleteTransaction', error);
            return res.status(500).json({
                success: false,
                error: 'Error al eliminar transacción'
            });
        }
    }

    // ==========================================
    // ACCOUNT ENDPOINTS
    // ==========================================

    /**
     * GET /api/v1/accounts
     * Get user accounts
     */
    async getAccounts(req, res) {
        try {
            const user = req.user;

            const accounts = await AccountDBService.findByUser(user.user_id);

            const formattedAccounts = accounts.map(a => ({
                id: a.account_id,
                name: a.name,
                type: a.type,
                category: a.category,
                bankName: a.bank_name,
                balance: parseFloat(a.balance),
                currency: a.currency || 'COP',
                creditLimit: a.credit_limit ? parseFloat(a.credit_limit) : null,
                color: a.color,
                icon: a.icon,
                isDefault: a.is_default,
                last4: a.account_number_last4
            }));

            // Calculate total balance
            const totalBalance = formattedAccounts.reduce((sum, acc) => {
                // Subtract credit card balances (they are debts)
                if (acc.type === 'credit_card') {
                    return sum - acc.balance;
                }
                return sum + acc.balance;
            }, 0);

            return res.status(200).json({
                success: true,
                accounts: formattedAccounts,
                totalBalance
            });

        } catch (error) {
            Logger.error('Error en getAccounts', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener cuentas'
            });
        }
    }

    /**
     * POST /api/v1/accounts
     * Create a new account
     */
    async createAccount(req, res) {
        try {
            const user = req.user;
            const { name, type, bankName, balance = 0, color, icon, creditLimit } = req.body;

            if (!name || !type) {
                return res.status(400).json({
                    success: false,
                    error: 'Nombre y tipo son requeridos'
                });
            }

            const account = await AccountDBService.create({
                userId: user.user_id,
                name,
                type,
                bankName,
                balance: parseFloat(balance),
                color,
                icon,
                creditLimit: creditLimit ? parseFloat(creditLimit) : null
            });

            return res.status(201).json({
                success: true,
                account: {
                    id: account.account_id,
                    name: account.name,
                    type: account.type,
                    balance: parseFloat(account.balance),
                    color: account.color,
                    icon: account.icon
                }
            });

        } catch (error) {
            Logger.error('Error en createAccount', error);
            return res.status(500).json({
                success: false,
                error: 'Error al crear cuenta'
            });
        }
    }

    // ==========================================
    // CATEGORY ENDPOINTS
    // ==========================================

    /**
     * GET /api/v1/categories
     * Get user categories
     */
    async getCategories(req, res) {
        try {
            const user = req.user;
            const { type } = req.query; // 'income', 'expense', or undefined for all

            const categories = await CategoryDBService.findByUser(user.user_id, type);

            const formattedCategories = categories.map(c => ({
                id: c.category_id,
                name: c.name,
                type: c.type,
                color: c.color,
                icon: c.icon,
                description: c.description
            }));

            return res.status(200).json({
                success: true,
                categories: formattedCategories
            });

        } catch (error) {
            Logger.error('Error en getCategories', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener categorías'
            });
        }
    }

    // ==========================================
    // GOALS ENDPOINTS
    // ==========================================

    /**
     * GET /api/v1/goals
     * Get user financial goals
     */
    async getGoals(req, res) {
        try {
            const user = req.user;
            const { query: dbQuery } = require('../config/database');

            const result = await dbQuery(
                `SELECT * FROM financial_goals 
         WHERE user_id = $1 AND status IN ('active', 'completed')
         ORDER BY priority DESC, target_date ASC`,
                [user.user_id]
            );

            const goals = result.rows.map(g => ({
                id: g.goal_id,
                name: g.name,
                description: g.description,
                targetAmount: parseFloat(g.target_amount),
                currentAmount: parseFloat(g.current_amount),
                progress: g.target_amount > 0
                    ? Math.round((g.current_amount / g.target_amount) * 100)
                    : 0,
                targetDate: g.target_date,
                startedAt: g.started_at,
                priority: g.priority,
                category: g.category,
                color: g.color,
                icon: g.icon,
                imageUrl: g.image_url,
                status: g.status
            }));

            return res.status(200).json({
                success: true,
                goals
            });

        } catch (error) {
            Logger.error('Error en getGoals', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener metas'
            });
        }
    }

    /**
     * POST /api/v1/goals
     * Create a new financial goal
     */
    async createGoal(req, res) {
        try {
            const user = req.user;
            const {
                name,
                description,
                targetAmount,
                targetDate,
                priority = 5,
                category = 'other',
                color = '#10b981',
                icon = 'target'
            } = req.body;

            if (!name || !targetAmount) {
                return res.status(400).json({
                    success: false,
                    error: 'Nombre y monto objetivo son requeridos'
                });
            }

            const { query: dbQuery } = require('../config/database');

            const result = await dbQuery(
                `INSERT INTO financial_goals 
         (user_id, name, description, target_amount, target_date, priority, category, color, icon)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
                [
                    user.user_id,
                    name,
                    description || null,
                    parseFloat(targetAmount),
                    targetDate || null,
                    priority,
                    category,
                    color,
                    icon
                ]
            );

            const goal = result.rows[0];

            return res.status(201).json({
                success: true,
                goal: {
                    id: goal.goal_id,
                    name: goal.name,
                    targetAmount: parseFloat(goal.target_amount),
                    currentAmount: 0,
                    progress: 0,
                    status: goal.status
                }
            });

        } catch (error) {
            Logger.error('Error en createGoal', error);
            return res.status(500).json({
                success: false,
                error: 'Error al crear meta'
            });
        }
    }

    /**
     * PUT /api/v1/goals/:id
     * Update a financial goal
     */
    async updateGoal(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const updateData = req.body;

            const { query: dbQuery } = require('../config/database');

            // Build dynamic update query
            const fields = [];
            const values = [id, user.user_id];
            let paramIndex = 3;

            const allowedFields = [
                'name', 'description', 'target_amount', 'current_amount',
                'target_date', 'priority', 'category', 'color', 'icon', 'status'
            ];

            for (const [key, value] of Object.entries(updateData)) {
                const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                if (allowedFields.includes(snakeKey)) {
                    fields.push(`${snakeKey} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (fields.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No hay campos válidos para actualizar'
                });
            }

            const result = await dbQuery(
                `UPDATE financial_goals 
         SET ${fields.join(', ')}, updated_at = NOW()
         WHERE goal_id = $1 AND user_id = $2
         RETURNING *`,
                values
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Meta no encontrada'
                });
            }

            const goal = result.rows[0];

            return res.status(200).json({
                success: true,
                goal: {
                    id: goal.goal_id,
                    name: goal.name,
                    targetAmount: parseFloat(goal.target_amount),
                    currentAmount: parseFloat(goal.current_amount),
                    progress: goal.target_amount > 0
                        ? Math.round((goal.current_amount / goal.target_amount) * 100)
                        : 0,
                    status: goal.status
                }
            });

        } catch (error) {
            Logger.error('Error en updateGoal', error);
            return res.status(500).json({
                success: false,
                error: 'Error al actualizar meta'
            });
        }
    }

    /**
     * POST /api/v1/goals/:id/deposit
     * Add money to a goal
     */
    async depositToGoal(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const { amount } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Monto debe ser mayor a 0'
                });
            }

            const { query: dbQuery } = require('../config/database');

            const result = await dbQuery(
                `UPDATE financial_goals 
         SET current_amount = current_amount + $3,
             status = CASE 
               WHEN (current_amount + $3) >= target_amount THEN 'completed'
               ELSE status
             END,
             completed_at = CASE 
               WHEN (current_amount + $3) >= target_amount THEN NOW()
               ELSE completed_at
             END,
             updated_at = NOW()
         WHERE goal_id = $1 AND user_id = $2 AND status = 'active'
         RETURNING *`,
                [id, user.user_id, parseFloat(amount)]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Meta no encontrada o no está activa'
                });
            }

            const goal = result.rows[0];
            const isCompleted = goal.status === 'completed';

            return res.status(200).json({
                success: true,
                goal: {
                    id: goal.goal_id,
                    name: goal.name,
                    currentAmount: parseFloat(goal.current_amount),
                    targetAmount: parseFloat(goal.target_amount),
                    progress: Math.round((goal.current_amount / goal.target_amount) * 100),
                    status: goal.status
                },
                message: isCompleted
                    ? `¡Felicidades! Completaste tu meta "${goal.name}" 🎉`
                    : `Depósito de $${amount} agregado a "${goal.name}"`
            });

        } catch (error) {
            Logger.error('Error en depositToGoal', error);
            return res.status(500).json({
                success: false,
                error: 'Error al depositar en meta'
            });
        }
    }
    /**
     * post /api/v1/test/seed
     * Execute seed script manually (Protected or Dev only)
     * Useful for Railway/Production where CLI is not easily accessible
     */
    async executeSeed(req, res) {
        try {
            const { exec } = require('child_process');

            // Only allow for authorized users or if special header/env present
            // For this demo, we'll allow it if the user is authenticated (which they are via middleware)
            // or if a secret key is provided in headers

            Logger.info('SEED: Iniciando ejecución manual del seed...');

            exec('npm run seed', (error, stdout, stderr) => {
                if (error) {
                    Logger.error(`SEED Error: ${error.message}`);
                    return res.status(500).json({
                        success: false,
                        error: 'Error al ejecutar seed',
                        details: error.message
                    });
                }

                if (stderr) {
                    Logger.warn(`SEED Stderr: ${stderr}`);
                }

                Logger.info(`SEED Stdout: ${stdout}`);

                return res.status(200).json({
                    success: true,
                    message: 'Seed ejecutado correctamente',
                    output: stdout
                });
            });

        } catch (error) {
            Logger.error('Error en executeSeed', error);
            return res.status(500).json({
                success: false,
                error: 'Error interno al intentar seed'
            });
        }
    }
}

module.exports = new ApiController();
