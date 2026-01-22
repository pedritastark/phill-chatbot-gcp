const { query } = require('../../config/database');
const Logger = require('../../utils/logger');
const crypto = require('crypto');

/**
 * Database service for auth_tokens table
 * Handles OTP codes and JWT refresh tokens
 */
class AuthDBService {
    /**
     * Generate a 6-digit OTP code
     * @returns {string} - 6-digit code
     */
    generateOTPCode() {
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Create an OTP entry for a user
     * @param {string} userId - UUID of the user
     * @param {Object} metadata - Optional metadata (ip, userAgent)
     * @returns {Promise<Object>} - Created auth token with OTP
     */
    async createOTP(userId, metadata = {}) {
        try {
            // Invalidate any existing OTPs for this user
            await query(
                `UPDATE auth_tokens SET is_valid = FALSE WHERE user_id = $1 AND otp_code IS NOT NULL AND is_valid = TRUE`,
                [userId]
            );

            const otpCode = this.generateOTPCode();
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

            const result = await query(
                `INSERT INTO auth_tokens (user_id, otp_code, otp_expires_at, ip_address, user_agent, device_info)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
                [
                    userId,
                    otpCode,
                    expiresAt,
                    metadata.ip || null,
                    metadata.userAgent || null,
                    metadata.deviceInfo ? JSON.stringify(metadata.deviceInfo) : null
                ]
            );

            Logger.info(`🔐 OTP generado para usuario: ${userId}`);
            return result.rows[0];
        } catch (error) {
            Logger.error('Error al crear OTP', error);
            throw error;
        }
    }

    /**
     * Verify an OTP code for a user
     * @param {string} userId - UUID of the user
     * @param {string} code - 6-digit OTP code
     * @returns {Promise<Object|null>} - Auth token if valid, null if invalid
     */
    async verifyOTP(userId, code) {
        try {
            // Find valid OTP
            const result = await query(
                `SELECT * FROM auth_tokens 
         WHERE user_id = $1 
           AND otp_code = $2 
           AND is_valid = TRUE 
           AND otp_expires_at > NOW()
           AND otp_attempts < 5`,
                [userId, code]
            );

            if (result.rows.length === 0) {
                // Increment attempts if there's an active OTP
                await query(
                    `UPDATE auth_tokens 
           SET otp_attempts = otp_attempts + 1 
           WHERE user_id = $1 AND otp_code IS NOT NULL AND is_valid = TRUE`,
                    [userId]
                );
                Logger.warning(`❌ OTP inválido para usuario: ${userId}`);
                return null;
            }

            // OTP is valid - invalidate it so it can't be reused
            const token = result.rows[0];
            await query(
                `UPDATE auth_tokens SET otp_code = NULL, otp_expires_at = NULL WHERE token_id = $1`,
                [token.token_id]
            );

            Logger.success(`✅ OTP verificado para usuario: ${userId}`);
            return token;
        } catch (error) {
            Logger.error('Error al verificar OTP', error);
            throw error;
        }
    }

    /**
     * Get remaining OTP attempts for a user
     * @param {string} userId - UUID of the user
     * @returns {Promise<number>} - Remaining attempts (0-5)
     */
    async getRemainingAttempts(userId) {
        try {
            const result = await query(
                `SELECT otp_attempts FROM auth_tokens 
         WHERE user_id = $1 AND otp_code IS NOT NULL AND is_valid = TRUE
         ORDER BY created_at DESC LIMIT 1`,
                [userId]
            );

            if (result.rows.length === 0) return 5;
            return Math.max(0, 5 - result.rows[0].otp_attempts);
        } catch (error) {
            Logger.error('Error al obtener intentos restantes', error);
            return 0;
        }
    }

    /**
     * Store a refresh token for a session
     * @param {string} tokenId - UUID of the auth_tokens entry
     * @param {string} refreshToken - The refresh token
     * @param {number} expiresInDays - Days until expiration (default 30)
     * @returns {Promise<Object>} - Updated auth token
     */
    async storeRefreshToken(tokenId, refreshToken, expiresInDays = 30) {
        try {
            const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

            const result = await query(
                `UPDATE auth_tokens 
         SET refresh_token = $2, refresh_expires_at = $3, updated_at = NOW()
         WHERE token_id = $1
         RETURNING *`,
                [tokenId, refreshToken, expiresAt]
            );

            return result.rows[0];
        } catch (error) {
            Logger.error('Error al guardar refresh token', error);
            throw error;
        }
    }

    /**
     * Find a valid session by refresh token
     * @param {string} refreshToken - The refresh token
     * @returns {Promise<Object|null>} - Auth token if valid, null if invalid
     */
    async findByRefreshToken(refreshToken) {
        try {
            const result = await query(
                `SELECT at.*, u.phone_number, u.name 
         FROM auth_tokens at
         JOIN users u ON at.user_id = u.user_id
         WHERE at.refresh_token = $1 
           AND at.is_valid = TRUE 
           AND at.refresh_expires_at > NOW()`,
                [refreshToken]
            );

            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            Logger.error('Error al buscar por refresh token', error);
            throw error;
        }
    }

    /**
     * Invalidate a session (logout)
     * @param {string} tokenId - UUID of the auth_tokens entry
     */
    async invalidateSession(tokenId) {
        try {
            await query(
                `UPDATE auth_tokens SET is_valid = FALSE WHERE token_id = $1`,
                [tokenId]
            );
            Logger.info(`🚪 Sesión invalidada: ${tokenId}`);
        } catch (error) {
            Logger.error('Error al invalidar sesión', error);
            throw error;
        }
    }

    /**
     * Invalidate all sessions for a user
     * @param {string} userId - UUID of the user
     */
    async invalidateAllSessions(userId) {
        try {
            await query(
                `UPDATE auth_tokens SET is_valid = FALSE WHERE user_id = $1`,
                [userId]
            );
            Logger.info(`🚪 Todas las sesiones invalidadas para usuario: ${userId}`);
        } catch (error) {
            Logger.error('Error al invalidar sesiones', error);
            throw error;
        }
    }

    /**
     * Clean up expired tokens (can be run by a cron job)
     * @returns {Promise<number>} - Number of deleted tokens
     */
    async cleanupExpiredTokens() {
        try {
            const result = await query(
                `DELETE FROM auth_tokens 
         WHERE (otp_expires_at IS NOT NULL AND otp_expires_at < NOW() - INTERVAL '1 day')
            OR (refresh_expires_at IS NOT NULL AND refresh_expires_at < NOW())
            OR (is_valid = FALSE AND updated_at < NOW() - INTERVAL '7 days')`
            );

            const deleted = result.rowCount || 0;
            if (deleted > 0) {
                Logger.info(`🧹 Limpieza: ${deleted} tokens expirados eliminados`);
            }
            return deleted;
        } catch (error) {
            Logger.error('Error al limpiar tokens expirados', error);
            return 0;
        }
    }
}

module.exports = new AuthDBService();
