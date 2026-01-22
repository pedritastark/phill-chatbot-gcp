const jwt = require('jsonwebtoken');
const { config } = require('../config/environment');
const { UserDBService, AuthDBService } = require('../services/db');
const Logger = require('../utils/logger');

/**
 * Authentication Middleware for API routes
 * Verifies JWT tokens and attaches user to request
 */

/**
 * Verify JWT access token
 * Attaches user object to req.user if valid
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Token de acceso requerido',
                code: 'NO_TOKEN'
            });
        }

        // Verify the token
        const decoded = jwt.verify(token, config.jwt.secret);

        // Get user from database
        const user = await UserDBService.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        // Attach user and token info to request
        req.user = user;
        req.tokenId = decoded.tokenId;

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Token inválido',
                code: 'INVALID_TOKEN'
            });
        }

        Logger.error('Error en autenticación', error);
        return res.status(500).json({
            success: false,
            error: 'Error interno de autenticación',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * Optional authentication - doesn't fail if no token
 * Just attaches user if token is valid
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        const user = await UserDBService.findById(decoded.userId);

        req.user = user || null;
        req.tokenId = decoded.tokenId;

        next();
    } catch (error) {
        // Token invalid but optional, so just continue without user
        req.user = null;
        next();
    }
};

/**
 * Generate access token (short-lived)
 * @param {Object} user - User object from database
 * @param {string} tokenId - Auth token ID for session tracking
 * @returns {string} - JWT access token
 */
const generateAccessToken = (user, tokenId) => {
    return jwt.sign(
        {
            userId: user.user_id,
            phoneNumber: user.phone_number,
            tokenId: tokenId
        },
        config.jwt.secret,
        { expiresIn: config.jwt.accessTokenExpiry }
    );
};

/**
 * Generate refresh token (long-lived)
 * @param {Object} user - User object from database
 * @param {string} tokenId - Auth token ID for session tracking
 * @returns {string} - JWT refresh token
 */
const generateRefreshToken = (user, tokenId) => {
    return jwt.sign(
        {
            userId: user.user_id,
            tokenId: tokenId,
            type: 'refresh'
        },
        config.jwt.secret,
        { expiresIn: config.jwt.refreshTokenExpiry }
    );
};

/**
 * Verify refresh token and return decoded data
 * @param {string} token - Refresh token
 * @returns {Object|null} - Decoded token or null if invalid
 */
const verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, config.jwt.secret);
        if (decoded.type !== 'refresh') {
            return null;
        }
        return decoded;
    } catch (error) {
        return null;
    }
};

module.exports = {
    authenticateToken,
    optionalAuth,
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken
};
