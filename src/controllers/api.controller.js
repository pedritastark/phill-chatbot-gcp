const {
    UserDBService,
    AuthDBService,
    TransactionDBService,
    AccountDBService,
    CategoryDBService,
    ReminderDBService
} = require('../services/db');
const FinanceService = require('../services/finance.service');
const WhatsAppService = require('../services/whatsapp.service');
const Logger = require('../utils/logger');
const bcrypt = require('bcrypt');
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
     * Verify OTP and return JWT tokens (for registration with password)
     */
    async verifyOTP(req, res) {
        try {
            const { phone, code, password } = req.body;

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

            // If password is provided, this is a registration - hash and store it
            if (password) {
                if (password.length < 6) {
                    return res.status(400).json({
                        success: false,
                        error: 'La contraseña debe tener al menos 6 caracteres'
                    });
                }

                const saltRounds = 10;
                const passwordHash = await bcrypt.hash(password, saltRounds);

                // Update user with password
                const { query } = require('../config/database');
                await query(
                    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2`,
                    [passwordHash, user.user_id]
                );

                Logger.success(`✅ Registro completado con contraseña: ${normalizedPhone}`);
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
     * POST /api/v1/auth/login
     * Login with phone and password (no OTP required)
     */
    async login(req, res) {
        try {
            const { phone, password } = req.body;

            if (!phone || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Teléfono y contraseña requeridos'
                });
            }

            // Normalize phone
            let normalizedPhone = phone.trim().replace(/\s+/g, '');
            if (!normalizedPhone.startsWith('+')) {
                normalizedPhone = '+57' + normalizedPhone.replace(/^0/, '');
            }
            const whatsappFormat = `whatsapp:${normalizedPhone}`;

            // Debug logging
            Logger.info(`🔍 LOGIN - Recibido: "${phone}" → Normalizado: "${normalizedPhone}" → WhatsApp: "${whatsappFormat}"`);

            // Find user
            const user = await UserDBService.findByPhoneNumber(whatsappFormat);
            if (!user) {
                Logger.warning(`⚠️ LOGIN - Usuario no encontrado: ${whatsappFormat}`);
            }
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Teléfono o contraseña incorrectos'
                });
            }

            // Check if user has a password set
            const { query } = require('../config/database');
            const result = await query(
                `SELECT password_hash FROM users WHERE user_id = $1`,
                [user.user_id]
            );

            if (!result.rows[0].password_hash) {
                Logger.warning(`⚠️ LOGIN - Sin contraseña configurada: ${whatsappFormat}`);
                return res.status(400).json({
                    success: false,
                    error: 'Esta cuenta no tiene contraseña configurada. Por favor regístrate nuevamente.',
                    code: 'NO_PASSWORD'
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, result.rows[0].password_hash);
            Logger.info(`🔑 LOGIN - Validación de contraseña: ${isPasswordValid ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);

            if (!isPasswordValid) {
                Logger.warning(`⚠️ LOGIN - Contraseña incorrecta para: ${whatsappFormat}`);
                return res.status(401).json({
                    success: false,
                    error: 'Teléfono o contraseña incorrectos'
                });
            }

            // Create auth session
            const authToken = await AuthDBService.createOTP(user.user_id, {
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            // Clear OTP fields since this is password login
            await query(
                `UPDATE auth_tokens SET otp_code = NULL, otp_expires_at = NULL WHERE token_id = $1`,
                [authToken.token_id]
            );

            // Generate tokens
            const accessToken = generateAccessToken(user, authToken.token_id);
            const refreshToken = generateRefreshToken(user, authToken.token_id);

            // Store refresh token
            await AuthDBService.storeRefreshToken(authToken.token_id, refreshToken);

            Logger.success(`✅ Login con contraseña exitoso: ${normalizedPhone}`);

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
            Logger.error('Error en login', error);
            return res.status(500).json({
                success: false,
                error: 'Error al iniciar sesión'
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
     * Get current user profile with all settings
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
                    createdAt: user.created_at,
                    // Settings
                    settings: {
                        // Security
                        twoFactorEnabled: user.two_factor_enabled || false,
                        // Notifications
                        notificationEmail: user.notification_email !== false,
                        notificationSms: user.notification_sms || false,
                        notificationTransactions: user.notification_transactions !== false,
                        notificationWeeklyReports: user.notification_weekly_reports !== false,
                        // Preferences
                        darkMode: user.dark_mode || false,
                        soundEffects: user.sound_effects !== false,
                        // Privacy
                        dataSharing: user.data_sharing !== false,
                        analyticsEnabled: user.analytics_enabled !== false,
                    }
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
                    phone: updatedUser.phone_number.replace('whatsapp:', ''),
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

    /**
     * PUT /api/v1/me/settings
     * Update user settings (notifications, preferences, privacy)
     */
    async updateSettings(req, res) {
        try {
            const user = req.user;
            const settings = req.body;

            const updatedUser = await UserDBService.updateSettings(user.user_id, settings);

            return res.status(200).json({
                success: true,
                settings: {
                    twoFactorEnabled: updatedUser.two_factor_enabled || false,
                    notificationEmail: updatedUser.notification_email !== false,
                    notificationSms: updatedUser.notification_sms || false,
                    notificationTransactions: updatedUser.notification_transactions !== false,
                    notificationWeeklyReports: updatedUser.notification_weekly_reports !== false,
                    language: updatedUser.language,
                    currency: updatedUser.currency,
                    darkMode: updatedUser.dark_mode || false,
                    soundEffects: updatedUser.sound_effects !== false,
                    dataSharing: updatedUser.data_sharing !== false,
                    analyticsEnabled: updatedUser.analytics_enabled !== false,
                },
                message: 'Configuración actualizada correctamente'
            });

        } catch (error) {
            Logger.error('Error en updateSettings', error);
            return res.status(500).json({
                success: false,
                error: 'Error al actualizar configuración'
            });
        }
    }

    /**
     * PUT /api/v1/me/password
     * Change user password
     */
    async changePassword(req, res) {
        try {
            const user = req.user;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Contraseña actual y nueva son requeridas'
                });
            }

            // Validate new password strength
            if (newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    error: 'La nueva contraseña debe tener al menos 8 caracteres'
                });
            }

            // Check if user has a password set
            if (user.password_hash) {
                const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
                if (!isValidPassword) {
                    return res.status(401).json({
                        success: false,
                        error: 'La contraseña actual es incorrecta'
                    });
                }
            }

            // Hash new password
            const saltRounds = 10;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

            // Update password
            await UserDBService.updatePassword(user.user_id, newPasswordHash);

            return res.status(200).json({
                success: true,
                message: 'Contraseña actualizada correctamente'
            });

        } catch (error) {
            Logger.error('Error en changePassword', error);
            return res.status(500).json({
                success: false,
                error: 'Error al cambiar la contraseña'
            });
        }
    }

    /**
     * GET /api/v1/me/sessions
     * Get all active sessions for the user
     */
    async getSessions(req, res) {
        try {
            const user = req.user;
            const currentToken = req.headers.authorization?.replace('Bearer ', '');

            const { query: dbQuery } = require('../config/database');

            const result = await dbQuery(
                `SELECT token_id, device_info, ip_address, user_agent, created_at, updated_at
                 FROM auth_tokens
                 WHERE user_id = $1 AND is_valid = true AND refresh_token IS NOT NULL
                 ORDER BY updated_at DESC`,
                [user.user_id]
            );

            const sessions = result.rows.map((session, index) => {
                // Parse device info from user_agent or device_info
                const userAgent = session.user_agent || '';
                let device = 'Dispositivo desconocido';
                let icon = 'monitor';

                if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
                    device = userAgent.includes('iPad') ? 'iPad' : 'iPhone';
                    icon = 'smartphone';
                } else if (userAgent.includes('Android')) {
                    device = 'Android';
                    icon = 'smartphone';
                } else if (userAgent.includes('Mac')) {
                    device = 'MacBook / Mac';
                    icon = 'monitor';
                } else if (userAgent.includes('Windows')) {
                    device = 'Windows PC';
                    icon = 'monitor';
                } else if (userAgent.includes('Chrome')) {
                    device = 'Chrome Browser';
                    icon = 'monitor';
                }

                // Check if this is the current session (first one is usually most recent)
                const isCurrent = index === 0;

                return {
                    id: session.token_id,
                    device,
                    icon,
                    location: 'Colombia', // Could be enhanced with IP geolocation
                    ipAddress: session.ip_address,
                    lastActive: session.updated_at,
                    createdAt: session.created_at,
                    current: isCurrent
                };
            });

            return res.status(200).json({
                success: true,
                sessions
            });

        } catch (error) {
            Logger.error('Error en getSessions', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener sesiones'
            });
        }
    }

    /**
     * DELETE /api/v1/me/sessions/:id
     * Terminate a specific session
     */
    async deleteSession(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;

            const { query: dbQuery } = require('../config/database');

            const result = await dbQuery(
                `UPDATE auth_tokens
                 SET is_valid = false, updated_at = CURRENT_TIMESTAMP
                 WHERE token_id = $1 AND user_id = $2
                 RETURNING *`,
                [id, user.user_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Sesión no encontrada'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Sesión cerrada correctamente'
            });

        } catch (error) {
            Logger.error('Error en deleteSession', error);
            return res.status(500).json({
                success: false,
                error: 'Error al cerrar sesión'
            });
        }
    }

    /**
     * DELETE /api/v1/me/sessions
     * Terminate all sessions except current
     */
    async deleteAllSessions(req, res) {
        try {
            const user = req.user;
            const currentToken = req.headers.authorization?.replace('Bearer ', '');

            const { query: dbQuery } = require('../config/database');

            // Invalidate all sessions for this user
            await dbQuery(
                `UPDATE auth_tokens
                 SET is_valid = false, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1 AND is_valid = true`,
                [user.user_id]
            );

            return res.status(200).json({
                success: true,
                message: 'Todas las sesiones han sido cerradas'
            });

        } catch (error) {
            Logger.error('Error en deleteAllSessions', error);
            return res.status(500).json({
                success: false,
                error: 'Error al cerrar sesiones'
            });
        }
    }

    /**
     * DELETE /api/v1/me
     * Delete user account permanently
     */
    async deleteAccount(req, res) {
        try {
            const user = req.user;
            const { confirmation } = req.body;

            // Require confirmation phrase
            if (confirmation !== 'Deseo cerrar mi cuenta') {
                return res.status(400).json({
                    success: false,
                    error: 'Frase de confirmación incorrecta'
                });
            }

            // Delete user (CASCADE will handle related data)
            await UserDBService.deleteUser(user.user_id);

            Logger.warning(`⚠️ Cuenta eliminada: ${user.phone_number}`);

            return res.status(200).json({
                success: true,
                message: 'Tu cuenta ha sido eliminada permanentemente'
            });

        } catch (error) {
            Logger.error('Error en deleteAccount', error);
            return res.status(500).json({
                success: false,
                error: 'Error al eliminar cuenta'
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
                categoryId,
                category_id,
                accountId,
                account_id,
                accountName,
                date,
                transactionDate,
                transaction_date,
                notes,
                currency = 'COP',
                status = 'completed'
            } = req.body;
            const resolvedAccountId = accountId || account_id || null;
            const resolvedCategoryId = categoryId || category_id || null;
            const resolvedTransactionDate = transactionDate || transaction_date || date;

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

            // Get account name from accountId if provided
            let resolvedAccountName = accountName;
            if (resolvedAccountId && !accountName) {
                const accounts = await AccountDBService.findByUser(user.user_id);
                const account = accounts.find(a => a.account_id === resolvedAccountId);
                if (account) {
                    resolvedAccountName = account.name;
                }
            }

            // Get category name from categoryId if provided
            let resolvedCategory = category;
            if (resolvedCategoryId && !category) {
                const categories = await CategoryDBService.findByUser(user.user_id);
                const cat = categories.find(c => c.category_id === resolvedCategoryId);
                if (cat) {
                    resolvedCategory = cat.name;
                }
            }

            const transaction = await FinanceService.createTransaction(
                user.phone_number,
                type,
                parseFloat(amount),
                description,
                resolvedCategory || null,
                resolvedAccountName || null,
                resolvedAccountId,
                currency,
                status,
                resolvedTransactionDate
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
            if (error.code === 'CREDIT_LIMIT_EXCEEDED') {
                return res.status(400).json({
                    success: false,
                    error: 'Cupo insuficiente en la tarjeta de crédito'
                });
            }
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
            const normalizedUpdateData = {
                ...updateData,
                accountId: updateData.accountId || updateData.account_id,
                categoryId: updateData.categoryId || updateData.category_id,
                transactionDate: updateData.transactionDate || updateData.transaction_date || updateData.date
            };

            // Verify ownership (transaction belongs to user)
            const transactions = await FinanceService.getUserTransactions(user.phone_number, {});
            const transaction = transactions.find(t => t.transaction_id === id);

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    error: 'Transacción no encontrada'
                });
            }

            const updated = await FinanceService.updateTransaction(id, normalizedUpdateData);

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

    /**
     * GET /api/v1/reminders
     */
    async getReminders(req, res) {
        try {
            const user = req.user;
            const reminders = await ReminderDBService.getByUser(user.user_id);
            return res.status(200).json({ success: true, reminders });
        } catch (error) {
            Logger.error('Error en getReminders', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener recordatorios'
            });
        }
    }

    /**
     * POST /api/v1/reminders
     */
    async createReminder(req, res) {
        try {
            const user = req.user;
            const {
                message,
                scheduledAt,
                amount = 0,
                currency = 'COP',
                accountId,
                accountName,
                transactionType = 'expense',
                isRecurring = false,
                recurrencePattern = null
            } = req.body;

            if (!message || !scheduledAt) {
                return res.status(400).json({
                    success: false,
                    error: 'Mensaje y fecha son requeridos'
                });
            }

            const reminder = await ReminderDBService.createReminder({
                userId: user.user_id,
                message,
                scheduledAt,
                isRecurring: !!isRecurring,
                recurrencePattern: recurrencePattern || null,
                amount: parseFloat(amount) || 0,
                currency: currency || 'COP',
                accountId: accountId || null,
                accountName: accountName || null,
                transactionType: transactionType || 'expense',
                completionStatus: 'pending',
                status: 'pending'
            });

            return res.status(201).json({ success: true, reminder });
        } catch (error) {
            Logger.error('Error en createReminder', error);
            return res.status(500).json({
                success: false,
                error: 'Error al crear recordatorio'
            });
        }
    }

    /**
     * PATCH /api/v1/reminders/:id/complete
     */
    async completeReminder(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const { mark = 'completed', accountId } = req.body;

            const reminder = await ReminderDBService.getById(id);
            if (!reminder || reminder.user_id !== user.user_id) {
                return res.status(404).json({
                    success: false,
                    error: 'Recordatorio no encontrado'
                });
            }

            if (mark === 'completed') {
                if (reminder.completion_status === 'completed') {
                    return res.status(200).json({ success: true, reminder });
                }

                const amount = parseFloat(reminder.amount);
                if (!amount || amount <= 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'El recordatorio no tiene un monto válido'
                    });
                }

                let account = null;
                const preferredAccountId = accountId || reminder.account_id;

                if (preferredAccountId) {
                    const candidate = await AccountDBService.findById(preferredAccountId);
                    if (candidate && candidate.user_id === user.user_id) {
                        account = candidate;
                    }
                }

                if (!account) {
                    account = await AccountDBService.getDefaultAccount(user.user_id);
                }

                const transaction = await FinanceService.createTransaction(
                    user.phone_number,
                    reminder.transaction_type || 'expense',
                    amount,
                    `Recordatorio: ${reminder.message}`,
                    null,
                    account ? account.name : reminder.account_name || null,
                    account ? account.account_id : null,
                    reminder.currency || 'COP',
                    'completed'
                );

                const updatedReminder = await ReminderDBService.updateReminder(id, {
                    completion_status: 'completed',
                    completed_at: new Date(),
                    linked_transaction_id: transaction.transaction_id,
                    account_id: account ? account.account_id : reminder.account_id,
                    account_name: account ? account.name : reminder.account_name,
                    status: 'sent'
                });

                return res.status(200).json({
                    success: true,
                    reminder: updatedReminder,
                    transaction
                });
            }

            if (reminder.completion_status === 'completed' && reminder.linked_transaction_id) {
                const linkedTransaction = await TransactionDBService.findById(reminder.linked_transaction_id);
                if (linkedTransaction && linkedTransaction.user_id === user.user_id) {
                    if (linkedTransaction.account_id) {
                        const account = await AccountDBService.findById(linkedTransaction.account_id);
                        if (account && account.user_id === user.user_id) {
                            const isLiability = ['credit_card', 'loan', 'debt'].includes(account.type);
                            let operation = 'add';
                            if (isLiability) {
                                operation = linkedTransaction.type === 'expense' ? 'subtract' : 'add';
                            } else {
                                operation = linkedTransaction.type === 'expense' ? 'add' : 'subtract';
                            }
                            await AccountDBService.updateBalance(account.account_id, linkedTransaction.amount, operation);
                        }
                    }

                    await FinanceService.deleteTransaction(linkedTransaction.transaction_id);
                }
            }

            const reverted = await ReminderDBService.updateReminder(id, {
                completion_status: 'pending',
                completed_at: null,
                linked_transaction_id: null,
                status: 'pending'
            });

            return res.status(200).json({ success: true, reminder: reverted });
        } catch (error) {
            if (error.code === 'CREDIT_LIMIT_EXCEEDED') {
                return res.status(400).json({
                    success: false,
                    error: 'Cupo insuficiente en la tarjeta de crédito'
                });
            }
            Logger.error('Error en completeReminder', error);
            return res.status(500).json({
                success: false,
                error: 'Error al actualizar recordatorio'
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

            const formattedAccounts = accounts.map(a => {
                const balance = parseFloat(a.balance);
                const interestRate = a.interest_rate ? parseFloat(a.interest_rate) : null;
                const isCreditCard = a.type === 'credit_card';
                const minimumPayment = isCreditCard ? Math.max(balance * 0.05, 0) : null;
                const monthlyInterest = isCreditCard && interestRate
                    ? (balance * (interestRate / 100) / 12)
                    : null;

                return {
                    id: a.account_id,
                    name: a.name,
                    type: a.type,
                    category: a.category,
                    bankName: a.bank_name,
                    balance,
                    currency: a.currency || 'COP',
                    creditLimit: a.credit_limit ? parseFloat(a.credit_limit) : null,
                    interestRate,
                    statementDay: a.statement_day,
                    dueDay: a.due_day,
                    minimumPayment,
                    monthlyInterest,
                    color: a.color,
                    icon: a.icon,
                    isDefault: a.is_default,
                    last4: a.account_number_last4
                };
            });

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
            const { name, type, bankName, balance = 0, color, icon, creditLimit, statementDay, dueDay, interestRate, createReminders } = req.body;
            const parsedStatementDay = statementDay ? parseInt(statementDay, 10) : null;
            const parsedDueDay = dueDay ? parseInt(dueDay, 10) : null;

            if (!name || !type) {
                return res.status(400).json({
                    success: false,
                    error: 'Nombre y tipo son requeridos'
                });
            }

            if (
                (parsedStatementDay && (parsedStatementDay < 1 || parsedStatementDay > 28)) ||
                (parsedDueDay && (parsedDueDay < 1 || parsedDueDay > 28))
            ) {
                return res.status(400).json({
                    success: false,
                    error: 'statementDay y dueDay deben estar entre 1 y 28'
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
                creditLimit: creditLimit ? parseFloat(creditLimit) : null,
                interestRate: interestRate ? parseFloat(interestRate) : null,
                statementDay: parsedStatementDay,
                dueDay: parsedDueDay
            });

            if (type === 'credit_card' && createReminders) {
                const { buildNextMonthlyDate } = require('../utils/dateUtils');
                const reminders = [];
                const statement = parsedStatementDay;
                const due = parsedDueDay;

                // Use buildNextMonthlyDate which safely handles February edge cases
                if (statement && statement >= 1 && statement <= 31) {
                    reminders.push({
                        userId: user.user_id,
                        message: `Corte de tarjeta ${name}`,
                        scheduledAt: buildNextMonthlyDate(statement).toISOString(),
                        isRecurring: true,
                        recurrencePattern: 'monthly'
                    });
                }

                if (due && due >= 1 && due <= 31) {
                    reminders.push({
                        userId: user.user_id,
                        message: `Pago de tarjeta ${name}`,
                        scheduledAt: buildNextMonthlyDate(due).toISOString(),
                        isRecurring: true,
                        recurrencePattern: 'monthly'
                    });
                }

                for (const reminderData of reminders) {
                    await ReminderDBService.createReminder(reminderData);
                }
            }

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

    /**
     * DELETE /api/v1/accounts/:id
     * Delete an account and all its transactions
     */
    async deleteAccountById(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const { query: dbQuery } = require('../config/database');

            // Verify account belongs to user
            const accountResult = await dbQuery(
                `SELECT * FROM accounts WHERE account_id = $1 AND user_id = $2`,
                [id, user.user_id]
            );

            if (accountResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Cuenta no encontrada'
                });
            }

            const account = accountResult.rows[0];

            // VALIDATION: Check if this is the user's last account
            const accountCountResult = await dbQuery(
                `SELECT COUNT(*) as count FROM accounts WHERE user_id = $1`,
                [user.user_id]
            );
            const accountCount = parseInt(accountCountResult.rows[0].count);

            if (accountCount === 1) {
                return res.status(400).json({
                    success: false,
                    error: 'No puedes eliminar tu única cuenta. Debes tener al menos una cuenta activa.'
                });
            }

            // VALIDATION: Warn about balance (included in response metadata)
            const hasBalance = Math.abs(parseFloat(account.balance || 0)) > 0;
            const balance = parseFloat(account.balance || 0);

            // Delete associated reminders for this account (e.g., credit card payment reminders)
            await dbQuery(
                `DELETE FROM reminders WHERE user_id = $1 AND message LIKE $2`,
                [user.user_id, `%${account.name}%`]
            );

            // Delete associated credit card purchases if any
            await dbQuery(
                `DELETE FROM credit_purchase_payments WHERE purchase_id IN
                 (SELECT purchase_id FROM credit_card_purchases WHERE account_id = $1)`,
                [id]
            );
            await dbQuery(
                `DELETE FROM credit_card_purchases WHERE account_id = $1`,
                [id]
            );

            // Delete all transactions for this account
            const transactionsResult = await dbQuery(
                `DELETE FROM transactions WHERE account_id = $1 RETURNING transaction_id`,
                [id]
            );
            const deletedTransactionsCount = transactionsResult.rows.length;

            // Delete the account
            await dbQuery(
                `DELETE FROM accounts WHERE account_id = $1`,
                [id]
            );

            Logger.info(`🗑️ Account ${id} (${account.name}) deleted for user ${user.user_id} - ${deletedTransactionsCount} transactions removed`);

            return res.status(200).json({
                success: true,
                message: `Cuenta "${account.name}" eliminada correctamente`,
                metadata: {
                    deletedTransactions: deletedTransactionsCount,
                    hadBalance: hasBalance,
                    balance: balance
                }
            });

        } catch (error) {
            Logger.error('Error en deleteAccountById', error);
            return res.status(500).json({
                success: false,
                error: 'Error al eliminar la cuenta'
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
     * Add money to a goal from a specific account
     * - Validates account exists and belongs to user
     * - Validates sufficient balance in source account
     * - Creates expense transaction for the transfer
     * - Updates account balance
     * - Updates goal current_amount
     */
    async depositToGoal(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const { amount, from_account_id } = req.body;

            // Validate amount
            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Monto debe ser mayor a 0'
                });
            }

            const parsedAmount = parseFloat(amount);

            // Validate from_account_id is provided
            if (!from_account_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cuenta de origen requerida'
                });
            }

            // Get source account and validate it belongs to user
            const sourceAccount = await AccountDBService.findById(from_account_id);
            if (!sourceAccount) {
                return res.status(404).json({
                    success: false,
                    error: 'Cuenta de origen no encontrada'
                });
            }

            if (sourceAccount.user_id !== user.user_id) {
                return res.status(403).json({
                    success: false,
                    error: 'No tienes permiso para usar esta cuenta'
                });
            }

            // Check sufficient balance (for non-credit accounts)
            const isLiability = ['credit_card', 'loan', 'debt'].includes(sourceAccount.type);
            if (!isLiability && parseFloat(sourceAccount.balance) < parsedAmount) {
                return res.status(400).json({
                    success: false,
                    error: 'Saldo insuficiente en la cuenta de origen'
                });
            }

            const { query: dbQuery } = require('../config/database');

            // First verify the goal exists and is active
            const goalCheck = await dbQuery(
                `SELECT * FROM financial_goals WHERE goal_id = $1 AND user_id = $2 AND status = 'active'`,
                [id, user.user_id]
            );

            if (goalCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Meta no encontrada o no está activa'
                });
            }

            const goalData = goalCheck.rows[0];

            // Find or create "Ahorro" category for expense
            const savingsCategory = await CategoryDBService.findOrCreate(
                user.user_id,
                'Ahorro',
                'expense'
            );

            // Create the transaction (expense from source account)
            const transaction = await TransactionDBService.create({
                userId: user.user_id,
                accountId: from_account_id,
                categoryId: savingsCategory.category_id,
                type: 'expense',
                amount: parsedAmount,
                description: `Depósito a meta: ${goalData.name}`,
                transactionDate: new Date(),
                notes: `Transferencia automática a meta de ahorro "${goalData.name}"`,
                currency: sourceAccount.currency || 'COP',
                status: 'completed'
            });

            // Update account balance (subtract for assets, add for liabilities)
            const operation = isLiability ? 'add' : 'subtract';
            await AccountDBService.updateBalance(from_account_id, parsedAmount, operation);

            // Update goal current_amount
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
                [id, user.user_id, parsedAmount]
            );

            const goal = result.rows[0];
            const isCompleted = goal.status === 'completed';

            Logger.success(`✅ Depósito a meta "${goal.name}": $${parsedAmount} desde ${sourceAccount.name}`);

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
                transaction: {
                    id: transaction.transaction_id,
                    amount: parsedAmount,
                    fromAccount: sourceAccount.name
                },
                message: isCompleted
                    ? `¡Felicidades! Completaste tu meta "${goal.name}" 🎉`
                    : `Depósito de $${parsedAmount.toLocaleString('es-CO')} agregado a "${goal.name}"`
            });

        } catch (error) {
            Logger.error('Error en depositToGoal', error);
            return res.status(500).json({
                success: false,
                error: 'Error al depositar en meta'
            });
        }
    }
    // ==========================================
    // DEBTS ENDPOINTS (Gestor de Deudas)
    // ==========================================

    /**
     * GET /api/v1/debts
     * Get all debts for the authenticated user
     */
    async getDebts(req, res) {
        try {
            const user = req.user;
            const { query: dbQuery } = require('../config/database');

            const result = await dbQuery(
                `SELECT * FROM debts
                 WHERE user_id = $1 AND status IN ('active', 'paid_off')
                 ORDER BY status ASC, created_at DESC`,
                [user.user_id]
            );

            const debts = result.rows.map(d => ({
                id: d.debt_id,
                name: d.name,
                totalAmount: parseFloat(d.total_amount),
                remainingAmount: parseFloat(d.remaining_amount),
                totalPaid: parseFloat(d.total_paid),
                interestRate: d.interest_rate ? parseFloat(d.interest_rate) : null,
                rateType: d.rate_type,
                termMonths: d.term_months,
                monthlyPayment: d.monthly_payment ? parseFloat(d.monthly_payment) : null,
                paymentDueDay: d.payment_due_day,
                linkedAccountId: d.linked_account_id,
                category: d.category,
                status: d.status,
                createdAt: d.created_at
            }));

            return res.status(200).json({
                success: true,
                debts
            });

        } catch (error) {
            Logger.error('Error en getDebts', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener deudas'
            });
        }
    }

    /**
     * POST /api/v1/debts
     * Create a new debt
     */
    async createDebt(req, res) {
        try {
            const user = req.user;
            const {
                name,
                totalAmount,
                interestRate,
                rateType = 'fixed',
                termMonths,
                monthlyPayment,
                paymentDueDay,
                linkedAccountId,
                category = 'other'
            } = req.body;

            if (!name || !totalAmount) {
                return res.status(400).json({
                    success: false,
                    error: 'Nombre y monto total son requeridos'
                });
            }

            const parsedAmount = parseFloat(totalAmount);
            if (parsedAmount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'El monto debe ser mayor a 0'
                });
            }

            const { query: dbQuery } = require('../config/database');

            const result = await dbQuery(
                `INSERT INTO debts
                 (user_id, name, total_amount, remaining_amount, interest_rate, rate_type, term_months, monthly_payment, payment_due_day, linked_account_id, category)
                 VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING *`,
                [
                    user.user_id,
                    name,
                    parsedAmount,
                    interestRate ? parseFloat(interestRate) : null,
                    rateType,
                    termMonths ? parseInt(termMonths) : null,
                    monthlyPayment ? parseFloat(monthlyPayment) : null,
                    paymentDueDay ? parseInt(paymentDueDay) : null,
                    linkedAccountId || null,
                    category
                ]
            );

            const debt = result.rows[0];

            return res.status(201).json({
                success: true,
                debt: {
                    id: debt.debt_id,
                    name: debt.name,
                    totalAmount: parseFloat(debt.total_amount),
                    remainingAmount: parseFloat(debt.remaining_amount),
                    totalPaid: 0,
                    category: debt.category,
                    status: debt.status
                }
            });

        } catch (error) {
            Logger.error('Error en createDebt', error);
            return res.status(500).json({
                success: false,
                error: 'Error al crear deuda'
            });
        }
    }

    /**
     * PUT /api/v1/debts/:id
     * Update a debt
     */
    async updateDebt(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const updateData = req.body;

            const { query: dbQuery } = require('../config/database');

            const fields = [];
            const values = [id, user.user_id];
            let paramIndex = 3;

            const allowedFields = [
                'name', 'interest_rate', 'rate_type', 'term_months',
                'monthly_payment', 'payment_due_day', 'linked_account_id', 'category', 'status'
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
                `UPDATE debts
                 SET ${fields.join(', ')}, updated_at = NOW()
                 WHERE debt_id = $1 AND user_id = $2
                 RETURNING *`,
                values
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Deuda no encontrada'
                });
            }

            const debt = result.rows[0];

            return res.status(200).json({
                success: true,
                debt: {
                    id: debt.debt_id,
                    name: debt.name,
                    totalAmount: parseFloat(debt.total_amount),
                    remainingAmount: parseFloat(debt.remaining_amount),
                    totalPaid: parseFloat(debt.total_paid),
                    status: debt.status
                }
            });

        } catch (error) {
            Logger.error('Error en updateDebt', error);
            return res.status(500).json({
                success: false,
                error: 'Error al actualizar deuda'
            });
        }
    }

    /**
     * DELETE /api/v1/debts/:id
     * Soft-delete a debt (set status to cancelled)
     */
    async deleteDebt(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;

            const { query: dbQuery } = require('../config/database');

            const result = await dbQuery(
                `UPDATE debts
                 SET status = 'cancelled', updated_at = NOW()
                 WHERE debt_id = $1 AND user_id = $2
                 RETURNING *`,
                [id, user.user_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Deuda no encontrada'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Deuda eliminada correctamente'
            });

        } catch (error) {
            Logger.error('Error en deleteDebt', error);
            return res.status(500).json({
                success: false,
                error: 'Error al eliminar deuda'
            });
        }
    }

    /**
     * POST /api/v1/debts/:id/payment
     * Register a payment towards a debt
     * - Validates account exists and has sufficient balance
     * - Calculates interest/principal split if rate exists
     * - Creates expense transaction
     * - Updates account balance
     * - Inserts debt_payment record
     * - Updates debt remaining_amount and total_paid
     * - Sets status to paid_off if remaining <= 0
     */
    async payDebt(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const { amount, from_account_id, notes } = req.body;

            // Validate amount
            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Monto debe ser mayor a 0'
                });
            }

            const parsedAmount = parseFloat(amount);

            // Validate from_account_id
            if (!from_account_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cuenta de origen requerida'
                });
            }

            // Get source account and validate
            const sourceAccount = await AccountDBService.findById(from_account_id);
            if (!sourceAccount) {
                return res.status(404).json({
                    success: false,
                    error: 'Cuenta de origen no encontrada'
                });
            }

            if (sourceAccount.user_id !== user.user_id) {
                return res.status(403).json({
                    success: false,
                    error: 'No tienes permiso para usar esta cuenta'
                });
            }

            // Check sufficient balance
            const isLiability = ['credit_card', 'loan', 'debt'].includes(sourceAccount.type);
            if (!isLiability && parseFloat(sourceAccount.balance) < parsedAmount) {
                return res.status(400).json({
                    success: false,
                    error: 'Saldo insuficiente en la cuenta de origen'
                });
            }

            const { query: dbQuery } = require('../config/database');

            // Verify debt exists and is active
            const debtCheck = await dbQuery(
                `SELECT * FROM debts WHERE debt_id = $1 AND user_id = $2 AND status = 'active'`,
                [id, user.user_id]
            );

            if (debtCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Deuda no encontrada o no está activa'
                });
            }

            const debtData = debtCheck.rows[0];
            const remaining = parseFloat(debtData.remaining_amount);
            const interestRate = debtData.interest_rate ? parseFloat(debtData.interest_rate) : null;

            // Calculate interest/principal split
            let interestAmount = 0;
            let principalAmount = parsedAmount;

            if (interestRate && interestRate > 0) {
                interestAmount = Math.round(remaining * (interestRate / 100 / 12));
                principalAmount = Math.max(0, parsedAmount - interestAmount);
            }

            // Cap principal to remaining amount
            if (principalAmount > remaining) {
                principalAmount = remaining;
            }

            // Find or create "Pago Deuda" category
            const debtCategory = await CategoryDBService.findOrCreate(
                user.user_id,
                'Pago Deuda',
                'expense'
            );

            // Create expense transaction
            const transaction = await TransactionDBService.create({
                userId: user.user_id,
                accountId: from_account_id,
                categoryId: debtCategory.category_id,
                type: 'expense',
                amount: parsedAmount,
                description: `Pago deuda: ${debtData.name}`,
                transactionDate: new Date(),
                notes: notes || `Pago a deuda "${debtData.name}"`,
                currency: sourceAccount.currency || 'COP',
                status: 'completed'
            });

            // Update account balance
            const operation = isLiability ? 'add' : 'subtract';
            await AccountDBService.updateBalance(from_account_id, parsedAmount, operation);

            // Insert debt payment record
            await dbQuery(
                `INSERT INTO debt_payments
                 (debt_id, user_id, amount, principal_amount, interest_amount, from_account_id, payment_date, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7)`,
                [id, user.user_id, parsedAmount, principalAmount, interestAmount, from_account_id, notes || null]
            );

            // Update debt: reduce remaining, increase total_paid
            const newRemaining = Math.max(0, remaining - principalAmount);
            const result = await dbQuery(
                `UPDATE debts
                 SET remaining_amount = $3,
                     total_paid = total_paid + $4,
                     status = CASE
                       WHEN $3 <= 0 THEN 'paid_off'
                       ELSE status
                     END,
                     updated_at = NOW()
                 WHERE debt_id = $1 AND user_id = $2
                 RETURNING *`,
                [id, user.user_id, newRemaining, parsedAmount]
            );

            const debt = result.rows[0];
            const isPaidOff = debt.status === 'paid_off';

            Logger.success(`Pago a deuda "${debt.name}": $${parsedAmount} desde ${sourceAccount.name}`);

            return res.status(200).json({
                success: true,
                debt: {
                    id: debt.debt_id,
                    name: debt.name,
                    remainingAmount: parseFloat(debt.remaining_amount),
                    totalAmount: parseFloat(debt.total_amount),
                    totalPaid: parseFloat(debt.total_paid),
                    status: debt.status
                },
                payment: {
                    amount: parsedAmount,
                    principalAmount,
                    interestAmount,
                    fromAccount: sourceAccount.name
                },
                transaction: {
                    id: transaction.transaction_id,
                    amount: parsedAmount
                },
                message: isPaidOff
                    ? `Deuda "${debt.name}" pagada completamente`
                    : `Pago de $${parsedAmount.toLocaleString('es-CO')} registrado a "${debt.name}"`
            });

        } catch (error) {
            Logger.error('Error en payDebt', error);
            return res.status(500).json({
                success: false,
                error: 'Error al registrar pago de deuda'
            });
        }
    }

    // ==========================================
    // CHATBOT WEB ENDPOINTS
    // ==========================================

    /**
     * POST /api/v1/chatbot/message
     * Send a message to Phill chatbot from web interface
     * Uses the same MessageService as WhatsApp
     */
    async sendChatMessage(req, res) {
        try {
            const user = req.user;
            const { message } = req.body;

            if (!message || !message.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Mensaje requerido'
                });
            }

            Logger.info(`💬 Web chat message from ${user.name}: "${message}"`);

            // Process message using the same service as WhatsApp
            const MessageService = require('../services/message.service');
            const response = await MessageService.processMessage(message.trim(), user.phone_number);

            // Extract text if response is an object with buttons
            let responseText = response;
            if (typeof response === 'object' && response.message) {
                responseText = response.message;
            }

            return res.status(200).json({
                success: true,
                response: responseText,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            Logger.error('Error en sendChatMessage', error);
            return res.status(500).json({
                success: false,
                error: 'Error al procesar mensaje del chatbot'
            });
        }
    }

    /**
     * GET /api/v1/chatbot/history
     * Get chat history for the logged-in user
     */
    async getChatHistory(req, res) {
        try {
            const user = req.user;
            const limit = parseInt(req.query.limit) || 50;

            const ConversationDBService = require('../services/db/conversation.db.service');
            const messages = await ConversationDBService.getConversationHistory(
                user.phone_number,
                limit
            );

            // Format messages for web display
            const formattedMessages = messages.map(msg => ({
                id: msg.message_id,
                type: msg.sender === 'user' ? 'user' : 'bot',
                text: msg.content,
                timestamp: msg.created_at
            }));

            return res.status(200).json({
                success: true,
                messages: formattedMessages
            });

        } catch (error) {
            Logger.error('Error en getChatHistory', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener historial del chat'
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
                    Logger.warning(`SEED Stderr: ${stderr}`);
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

    // ==========================================
    // CREDIT CARD PURCHASES ENDPOINTS
    // ==========================================

    /**
     * GET /api/v1/credit-purchases
     * Get all credit card purchases for the user
     */
    async getCreditPurchases(req, res) {
        try {
            const user = req.user;
            const { status = 'active', accountId } = req.query;

            const { query: dbQuery } = require('../config/database');

            let sql = `
                SELECT 
                    p.*,
                    a.name as account_name,
                    a.bank_name
                FROM credit_card_purchases p
                JOIN accounts a ON p.account_id = a.account_id
                WHERE p.user_id = $1
            `;
            const params = [user.user_id];

            if (status && status !== 'all') {
                params.push(status);
                sql += ` AND p.status = $${params.length}`;
            }

            if (accountId) {
                params.push(accountId);
                sql += ` AND p.account_id = $${params.length}`;
            }

            sql += ' ORDER BY p.purchase_date DESC';

            const result = await dbQuery(sql, params);

            const purchases = result.rows.map(p => ({
                id: p.purchase_id,
                accountId: p.account_id,
                accountName: p.account_name,
                bankName: p.bank_name,
                description: p.description,
                totalAmount: parseFloat(p.total_amount),
                installments: p.installments,
                installmentAmount: parseFloat(p.installment_amount),
                paidInstallments: p.paid_installments,
                remainingInstallments: p.installments - p.paid_installments,
                remainingAmount: parseFloat(p.remaining_amount),
                totalPaid: parseFloat(p.total_paid || 0),
                purchaseDate: p.purchase_date,
                status: p.status,
                progressPercent: Math.round((p.paid_installments / p.installments) * 100)
            }));

            return res.status(200).json({
                success: true,
                purchases
            });

        } catch (error) {
            Logger.error('Error en getCreditPurchases', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener compras a cuotas'
            });
        }
    }

    /**
     * POST /api/v1/credit-purchases
     * Create a new credit card purchase with installments
     */
    async createCreditPurchase(req, res) {
        try {
            const user = req.user;
            const { accountId, description, totalAmount, installments, firstPaymentDate } = req.body;

            // Validate required fields
            if (!accountId || !description || !totalAmount || !installments) {
                return res.status(400).json({
                    success: false,
                    error: 'Faltan campos requeridos: accountId, description, totalAmount, installments'
                });
            }

            // Validate installments range
            if (installments < 1 || installments > 48) {
                return res.status(400).json({
                    success: false,
                    error: 'El número de cuotas debe estar entre 1 y 48'
                });
            }

            // Verify account exists and is a credit card
            const { query: dbQuery } = require('../config/database');

            const accountResult = await dbQuery(
                `SELECT * FROM accounts WHERE account_id = $1 AND user_id = $2 AND type = 'credit_card'`,
                [accountId, user.user_id]
            );

            if (accountResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Tarjeta de crédito no encontrada'
                });
            }

            const account = accountResult.rows[0];
            const limit = parseFloat(account.credit_limit || 0);
            const usedCredit = Math.abs(parseFloat(account.balance || 0)); // Usar valor absoluto
            if (limit > 0 && (usedCredit + parseFloat(totalAmount)) > limit) {
                const available = limit - usedCredit;
                return res.status(400).json({
                    success: false,
                    error: `Cupo insuficiente. Disponible: $${available.toLocaleString('es-CO')}`
                });
            }

            // Calculate installment amount
            const installmentAmount = Math.ceil(totalAmount / installments);

            // Create purchase
            const result = await dbQuery(
                `INSERT INTO credit_card_purchases 
                (user_id, account_id, description, total_amount, installments, installment_amount, remaining_amount, first_payment_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *`,
                [user.user_id, accountId, description, totalAmount, installments, installmentAmount, totalAmount, firstPaymentDate || null]
            );

            const purchase = result.rows[0];

            // Register expense transaction to increase credit card debt
            const purchaseTransaction = await FinanceService.createTransaction(
                user.phone_number,
                'expense',
                parseFloat(totalAmount),
                `Compra a cuotas: ${description}`,
                'Compras a Cuotas',
                account.name,
                account.account_id,
                'COP',
                'completed'
            );

            await dbQuery(
                `UPDATE credit_card_purchases SET linked_transaction_id = $1 WHERE purchase_id = $2`,
                [purchaseTransaction.transaction_id, purchase.purchase_id]
            );

            Logger.info(`💳 Nueva compra a cuotas: ${description} - ${installments} cuotas de $${installmentAmount.toLocaleString()}`);

            return res.status(201).json({
                success: true,
                purchase: {
                    id: purchase.purchase_id,
                    description: purchase.description,
                    totalAmount: parseFloat(purchase.total_amount),
                    installments: purchase.installments,
                    installmentAmount: parseFloat(purchase.installment_amount),
                    remainingAmount: parseFloat(purchase.remaining_amount),
                    status: purchase.status
                },
                message: `Compra registrada: ${installments} cuotas de $${installmentAmount.toLocaleString('es-CO')}`
            });

        } catch (error) {
            Logger.error('Error en createCreditPurchase', error);
            return res.status(500).json({
                success: false,
                error: 'Error al registrar la compra'
            });
        }
    }

    /**
     * POST /api/v1/credit-purchases/:id/payment
     * Record a payment towards a credit card purchase
     */
    async recordPurchasePayment(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const { amount, notes } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'El monto del pago debe ser mayor a 0'
                });
            }

            const { query: dbQuery } = require('../config/database');

            // Get purchase
            const purchaseResult = await dbQuery(
                `SELECT * FROM credit_card_purchases WHERE purchase_id = $1 AND user_id = $2`,
                [id, user.user_id]
            );

            if (purchaseResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Compra no encontrada'
                });
            }

            const purchase = purchaseResult.rows[0];

            if (purchase.status === 'paid_off') {
                return res.status(400).json({
                    success: false,
                    error: 'Esta compra ya está pagada'
                });
            }

            // Calculate new values
            const newRemainingAmount = Math.max(0, parseFloat(purchase.remaining_amount) - amount);
            const newTotalPaid = parseFloat(purchase.total_paid || 0) + amount;

            // Estimate paid installments based on total paid
            const installmentAmount = parseFloat(purchase.installment_amount);
            const newPaidInstallments = Math.min(purchase.installments, Math.floor(newTotalPaid / installmentAmount));

            // Determine new status
            const newStatus = newRemainingAmount <= 0 ? 'paid_off' : 'active';

            // Update purchase
            await dbQuery(
                `UPDATE credit_card_purchases 
                 SET remaining_amount = $1, 
                     total_paid = $2,
                     paid_installments = $3, 
                     status = $4,
                     last_payment_date = CURRENT_DATE
                 WHERE purchase_id = $5`,
                [newRemainingAmount, newTotalPaid, newPaidInstallments, newStatus, id]
            );

            // Register income transaction to reduce credit card debt
            const paymentTransaction = await FinanceService.createTransaction(
                user.phone_number,
                'income',
                parseFloat(amount),
                `Pago cuota: ${purchase.description}`,
                'Pago Tarjeta',
                null,
                purchase.account_id,
                'COP',
                'completed'
            );

            await dbQuery(
                `INSERT INTO credit_purchase_payments (purchase_id, user_id, amount, notes, linked_transaction_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [id, user.user_id, amount, notes || null, paymentTransaction.transaction_id]
            );

            Logger.info(`💰 Pago registrado: $${amount.toLocaleString()} para "${purchase.description}"`);

            return res.status(200).json({
                success: true,
                message: newStatus === 'paid_off'
                    ? '¡Felicidades! Has terminado de pagar esta compra 🎉'
                    : `Pago de $${amount.toLocaleString('es-CO')} registrado`,
                purchase: {
                    id: purchase.purchase_id,
                    description: purchase.description,
                    remainingAmount: newRemainingAmount,
                    totalPaid: newTotalPaid,
                    paidInstallments: newPaidInstallments,
                    remainingInstallments: purchase.installments - newPaidInstallments,
                    status: newStatus
                }
            });

        } catch (error) {
            if (error.code === 'CREDIT_LIMIT_EXCEEDED') {
                return res.status(400).json({
                    success: false,
                    error: 'Cupo insuficiente en la tarjeta de crédito'
                });
            }
            Logger.error('Error en recordPurchasePayment', error);
            return res.status(500).json({
                success: false,
                error: 'Error al registrar el pago'
            });
        }
    }

    /**
     * POST /api/v1/credit-purchases/payments
     * Record a payment across multiple purchases or as balance-only
     */
    async recordCardPayment(req, res) {
        try {
            const user = req.user;
            const { accountId, amount, mode = 'auto', allocations = [], notes } = req.body;

            if (!accountId) {
                return res.status(400).json({
                    success: false,
                    error: 'accountId es requerido'
                });
            }

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'El monto del pago debe ser mayor a 0'
                });
            }

            const { query: dbQuery } = require('../config/database');

            const accountResult = await dbQuery(
                `SELECT * FROM accounts WHERE account_id = $1 AND user_id = $2 AND type = 'credit_card'`,
                [accountId, user.user_id]
            );

            if (accountResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Tarjeta de crédito no encontrada'
                });
            }

            const paymentTransaction = await FinanceService.createTransaction(
                user.phone_number,
                'income',
                parseFloat(amount),
                mode === 'balance_only' ? 'Pago a saldo de tarjeta' : 'Pago tarjeta (cuotas)',
                'Pago Tarjeta',
                null,
                accountId,
                'COP',
                'completed'
            );

            if (mode === 'balance_only') {
                return res.status(200).json({
                    success: true,
                    message: 'Pago aplicado al saldo de la tarjeta',
                    transactionId: paymentTransaction.transaction_id
                });
            }

            const purchaseResult = await dbQuery(
                `SELECT * FROM credit_card_purchases
                 WHERE user_id = $1 AND account_id = $2 AND status = 'active'
                 ORDER BY purchase_date ASC`,
                [user.user_id, accountId]
            );

            const purchases = purchaseResult.rows;
            if (purchases.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No hay compras activas para esta tarjeta'
                });
            }

            let remaining = parseFloat(amount);
            let appliedTotal = 0;
            const applied = [];

            const applyPaymentToPurchase = async (purchase, payAmount) => {
                if (payAmount <= 0) return;

                const newRemainingAmount = Math.max(0, parseFloat(purchase.remaining_amount) - payAmount);
                const newTotalPaid = parseFloat(purchase.total_paid || 0) + payAmount;
                const installmentAmount = parseFloat(purchase.installment_amount);
                const newPaidInstallments = Math.min(purchase.installments, Math.floor(newTotalPaid / installmentAmount));
                const newStatus = newRemainingAmount <= 0 ? 'paid_off' : 'active';

                await dbQuery(
                    `UPDATE credit_card_purchases 
                     SET remaining_amount = $1, 
                         total_paid = $2,
                         paid_installments = $3, 
                         status = $4,
                         last_payment_date = CURRENT_DATE
                     WHERE purchase_id = $5`,
                    [newRemainingAmount, newTotalPaid, newPaidInstallments, newStatus, purchase.purchase_id]
                );

                await dbQuery(
                    `INSERT INTO credit_purchase_payments (purchase_id, user_id, amount, notes, linked_transaction_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [purchase.purchase_id, user.user_id, payAmount, notes || null, paymentTransaction.transaction_id]
                );

                applied.push({
                    purchaseId: purchase.purchase_id,
                    amount: payAmount,
                    status: newStatus
                });
                appliedTotal += payAmount;
            };

            if (mode === 'manual') {
                if (!Array.isArray(allocations) || allocations.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Debes enviar allocations para pago manual'
                    });
                }

                const purchaseMap = new Map(purchases.map(p => [p.purchase_id, p]));
                for (const allocation of allocations) {
                    const purchase = purchaseMap.get(allocation.purchaseId);
                    const allocationAmount = parseFloat(allocation.amount);
                    if (!purchase) {
                        return res.status(400).json({
                            success: false,
                            error: 'Una de las compras seleccionadas no existe'
                        });
                    }
                    if (!allocationAmount || allocationAmount <= 0) {
                        return res.status(400).json({
                            success: false,
                            error: 'El monto asignado debe ser mayor a 0'
                        });
                    }
                    if (allocationAmount > remaining) {
                        return res.status(400).json({
                            success: false,
                            error: 'La suma de asignaciones excede el monto del pago'
                        });
                    }

                    await applyPaymentToPurchase(purchase, allocationAmount);
                    remaining -= allocationAmount;
                }
            } else {
                for (const purchase of purchases) {
                    if (remaining <= 0) break;
                    const alloc = Math.min(parseFloat(purchase.remaining_amount), remaining);
                    await applyPaymentToPurchase(purchase, alloc);
                    remaining -= alloc;
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Pago registrado correctamente',
                applied,
                appliedTotal,
                unallocatedAmount: remaining,
                transactionId: paymentTransaction.transaction_id
            });

        } catch (error) {
            if (error.code === 'CREDIT_LIMIT_EXCEEDED') {
                return res.status(400).json({
                    success: false,
                    error: 'Cupo insuficiente en la tarjeta de crédito'
                });
            }
            Logger.error('Error en recordCardPayment', error);
            return res.status(500).json({
                success: false,
                error: 'Error al registrar el pago'
            });
        }
    }

    // ==========================================
    // SUBSCRIPTION ENDPOINTS
    // ==========================================

    /**
     * GET /api/v1/subscriptions/current
     * Get user's current active subscription
     */
    async getCurrentSubscription(req, res) {
        try {
            const user = req.user;
            const { query: dbQuery } = require('../config/database');

            const result = await dbQuery(
                `SELECT * FROM subscriptions 
                 WHERE user_id = $1 
                 AND status = 'active' 
                 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [user.user_id]
            );

            if (result.rows.length === 0) {
                return res.status(200).json({
                    success: true,
                    subscription: null,
                    hasSubscription: false
                });
            }

            const sub = result.rows[0];
            return res.status(200).json({
                success: true,
                hasSubscription: true,
                subscription: {
                    id: sub.id,
                    planType: sub.plan_type,
                    status: sub.status,
                    startedAt: sub.started_at,
                    expiresAt: sub.expires_at,
                    amountPaid: sub.amount_paid ? parseFloat(sub.amount_paid) : null,
                    currency: sub.currency
                }
            });

        } catch (error) {
            Logger.error('Error en getCurrentSubscription', error);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener suscripción'
            });
        }
    }

    /**
     * POST /api/v1/subscriptions
     * Create a new subscription (after payment)
     */
    async createSubscription(req, res) {
        try {
            const user = req.user;
            const { planType, paymentReference, amountPaid, currency = 'COP' } = req.body;
            const { query: dbQuery } = require('../config/database');

            const validPlans = ['basico', 'premium', 'empresas'];
            if (!planType || !validPlans.includes(planType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Plan inválido. Opciones: basico, premium, empresas'
                });
            }

            // Check for existing active subscription
            const existing = await dbQuery(
                `SELECT id FROM subscriptions 
                 WHERE user_id = $1 AND status = 'active'`,
                [user.user_id]
            );

            if (existing.rows.length > 0) {
                // Update existing subscription to cancelled
                await dbQuery(
                    `UPDATE subscriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $1`,
                    [existing.rows[0].id]
                );
            }

            // Calculate expiration (30 days from now for monthly plans)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            const result = await dbQuery(
                `INSERT INTO subscriptions 
                 (user_id, plan_type, status, payment_reference, amount_paid, currency, expires_at)
                 VALUES ($1, $2, 'active', $3, $4, $5, $6)
                 RETURNING *`,
                [user.user_id, planType, paymentReference || null, amountPaid || null, currency, expiresAt]
            );

            const sub = result.rows[0];
            Logger.info(`💳 Nueva suscripción: ${planType} para usuario ${user.user_id}`);

            return res.status(201).json({
                success: true,
                message: `Suscripción ${planType} activada correctamente`,
                subscription: {
                    id: sub.id,
                    planType: sub.plan_type,
                    status: sub.status,
                    startedAt: sub.started_at,
                    expiresAt: sub.expires_at
                }
            });

        } catch (error) {
            Logger.error('Error en createSubscription', error);
            return res.status(500).json({
                success: false,
                error: 'Error al crear suscripción'
            });
        }
    }
}

module.exports = new ApiController();
