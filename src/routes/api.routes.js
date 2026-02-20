const express = require('express');
const router = express.Router();
const ApiController = require('../controllers/api.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

/**
 * API Routes for Web Dashboard
 * Base path: /api/v1
 */

// ==========================================
// PUBLIC ROUTES (No authentication required)
// ==========================================

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Phill API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Seed (Temporary for setup)
router.get('/test/seed', ApiController.executeSeed.bind(ApiController));

// Authentication
router.post('/auth/request-otp', ApiController.requestOTP.bind(ApiController));
router.post('/auth/verify-otp', ApiController.verifyOTP.bind(ApiController));
router.post('/auth/login', ApiController.login.bind(ApiController));
router.post('/auth/refresh', ApiController.refreshToken.bind(ApiController));

// ==========================================
// PROTECTED ROUTES (Require authentication)
// ==========================================

// Apply authentication middleware to all routes below
router.use(authenticateToken);

// Auth (protected)
router.post('/auth/logout', ApiController.logout.bind(ApiController));

// User Profile
router.get('/me', ApiController.getProfile.bind(ApiController));
router.put('/me', ApiController.updateProfile.bind(ApiController));
router.delete('/me', ApiController.deleteAccount.bind(ApiController));

// User Settings
router.put('/me/settings', ApiController.updateSettings.bind(ApiController));
router.put('/me/password', ApiController.changePassword.bind(ApiController));

// User Sessions
router.get('/me/sessions', ApiController.getSessions.bind(ApiController));
router.delete('/me/sessions', ApiController.deleteAllSessions.bind(ApiController));
router.delete('/me/sessions/:id', ApiController.deleteSession.bind(ApiController));

// Dashboard
router.get('/summary', ApiController.getSummary.bind(ApiController));

// Transactions
router.get('/transactions', ApiController.getTransactions.bind(ApiController));
router.post('/transactions', ApiController.createTransaction.bind(ApiController));
router.put('/transactions/:id', ApiController.updateTransaction.bind(ApiController));
router.delete('/transactions/:id', ApiController.deleteTransaction.bind(ApiController));

// Reminders
router.get('/reminders', ApiController.getReminders.bind(ApiController));
router.post('/reminders', ApiController.createReminder.bind(ApiController));
router.patch('/reminders/:id/complete', ApiController.completeReminder.bind(ApiController));

// Accounts
router.get('/accounts', ApiController.getAccounts.bind(ApiController));
router.post('/accounts', ApiController.createAccount.bind(ApiController));
router.delete('/accounts/:id', ApiController.deleteAccountById.bind(ApiController));

// Categories
router.get('/categories', ApiController.getCategories.bind(ApiController));

// Goals
router.get('/goals', ApiController.getGoals.bind(ApiController));
router.post('/goals', ApiController.createGoal.bind(ApiController));
router.put('/goals/:id', ApiController.updateGoal.bind(ApiController));
router.post('/goals/:id/deposit', ApiController.depositToGoal.bind(ApiController));

// Credit Card Purchases (Compras a Cuotas)
router.get('/credit-purchases', ApiController.getCreditPurchases.bind(ApiController));
router.post('/credit-purchases', ApiController.createCreditPurchase.bind(ApiController));
router.post('/credit-purchases/:id/payment', ApiController.recordPurchasePayment.bind(ApiController));
router.post('/credit-purchases/payments', ApiController.recordCardPayment.bind(ApiController));

// Subscriptions
router.get('/subscriptions/current', ApiController.getCurrentSubscription.bind(ApiController));
router.post('/subscriptions', ApiController.createSubscription.bind(ApiController));

// Chatbot Web
router.post('/chatbot/message', ApiController.sendChatMessage.bind(ApiController));
router.get('/chatbot/history', ApiController.getChatHistory.bind(ApiController));

// ==========================================
// 404 Handler for API routes
// ==========================================
router.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint no encontrado',
        path: req.path
    });
});

module.exports = router;
