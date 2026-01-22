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

// Authentication
router.post('/auth/request-otp', ApiController.requestOTP.bind(ApiController));
router.post('/auth/verify-otp', ApiController.verifyOTP.bind(ApiController));
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

// Dashboard
router.get('/summary', ApiController.getSummary.bind(ApiController));

// Transactions
router.get('/transactions', ApiController.getTransactions.bind(ApiController));
router.post('/transactions', ApiController.createTransaction.bind(ApiController));
router.put('/transactions/:id', ApiController.updateTransaction.bind(ApiController));
router.delete('/transactions/:id', ApiController.deleteTransaction.bind(ApiController));

// Accounts
router.get('/accounts', ApiController.getAccounts.bind(ApiController));
router.post('/accounts', ApiController.createAccount.bind(ApiController));

// Categories
router.get('/categories', ApiController.getCategories.bind(ApiController));

// Goals
router.get('/goals', ApiController.getGoals.bind(ApiController));
router.post('/goals', ApiController.createGoal.bind(ApiController));
router.put('/goals/:id', ApiController.updateGoal.bind(ApiController));
router.post('/goals/:id/deposit', ApiController.depositToGoal.bind(ApiController));

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
