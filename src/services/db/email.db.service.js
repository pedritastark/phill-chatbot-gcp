const { query, transaction } = require('../../config/database');
const Logger = require('../../utils/logger');

/**
 * Email Database Service
 *
 * Handles database operations for:
 * - email_integrations (Gmail OAuth connections)
 * - email_transactions (Parsed emails pending confirmation)
 * - email_bank_patterns (Known bank email patterns)
 */
class EmailDBService {
  // ===================================
  // EMAIL INTEGRATIONS (OAuth)
  // ===================================

  /**
   * Creates a new email integration
   * @param {Object} integrationData
   * @returns {Promise<Object>} - Created integration
   */
  async createIntegration(integrationData) {
    try {
      const {
        userId,
        emailAddress,
        provider = 'gmail',
        accessToken,
        refreshToken,
        tokenExpiresAt,
        syncFrequency = 'half_hourly',
        isActive = true,
      } = integrationData;

      const result = await query(
        `INSERT INTO email_integrations (
          user_id, email_address, provider,
          access_token, refresh_token, token_expires_at,
          sync_frequency, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, email_address)
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          token_expires_at = EXCLUDED.token_expires_at,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
        [
          userId,
          emailAddress,
          provider,
          accessToken,
          refreshToken,
          tokenExpiresAt,
          syncFrequency,
          isActive,
        ]
      );

      Logger.success(`✅ Email integration created for ${emailAddress}`);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error creating email integration', error);
      throw error;
    }
  }

  /**
   * Gets integration by user ID
   * @param {string} userId - User UUID
   * @returns {Promise<Object|null>}
   */
  async getIntegrationByUserId(userId) {
    try {
      const result = await query(
        `SELECT * FROM email_integrations
         WHERE user_id = $1 AND is_active = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error fetching email integration', error);
      throw error;
    }
  }

  /**
   * Gets integration by integration ID
   * @param {string} integrationId - Integration UUID
   * @returns {Promise<Object|null>}
   */
  async getIntegrationById(integrationId) {
    try {
      const result = await query(
        `SELECT * FROM email_integrations WHERE integration_id = $1`,
        [integrationId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error fetching email integration by ID', error);
      throw error;
    }
  }

  /**
   * Updates integration tokens
   * @param {string} integrationId - Integration UUID
   * @param {Object} tokens - { accessToken, refreshToken, expiresAt }
   * @returns {Promise<Object>}
   */
  async updateTokens(integrationId, tokens) {
    try {
      const result = await query(
        `UPDATE email_integrations
         SET access_token = $2,
             refresh_token = COALESCE($3, refresh_token),
             token_expires_at = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE integration_id = $1
         RETURNING *`,
        [
          integrationId,
          tokens.accessToken,
          tokens.refreshToken || null,
          tokens.expiresAt,
        ]
      );

      return result.rows[0];
    } catch (error) {
      Logger.error('Error updating integration tokens', error);
      throw error;
    }
  }

  /**
   * Updates last sync timestamp and message ID
   * @param {string} integrationId - Integration UUID
   * @param {string} lastMessageId - Last processed message ID
   * @returns {Promise<Object>}
   */
  async updateLastSync(integrationId, lastMessageId = null) {
    try {
      const result = await query(
        `UPDATE email_integrations
         SET last_sync_at = CURRENT_TIMESTAMP,
             last_message_id = COALESCE($2, last_message_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE integration_id = $1
         RETURNING *`,
        [integrationId, lastMessageId]
      );

      return result.rows[0];
    } catch (error) {
      Logger.error('Error updating last sync', error);
      throw error;
    }
  }

  /**
   * Deactivates integration (user disconnects Gmail)
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>}
   */
  async deactivateIntegration(userId) {
    try {
      await query(
        `UPDATE email_integrations
         SET is_active = false,
             access_token = NULL,
             refresh_token = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId]
      );

      Logger.success(`✅ Email integration deactivated for user ${userId}`);
      return true;
    } catch (error) {
      Logger.error('Error deactivating email integration', error);
      throw error;
    }
  }

  /**
   * Gets all active integrations ready for sync
   * @returns {Promise<Array>}
   */
  async getActiveIntegrations() {
    try {
      const result = await query(
        `SELECT * FROM email_integrations
         WHERE is_active = true
         ORDER BY last_sync_at ASC NULLS FIRST`
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error fetching active integrations', error);
      throw error;
    }
  }

  // ===================================
  // EMAIL TRANSACTIONS (Parsed Emails)
  // ===================================

  /**
   * Creates a new email transaction
   * @param {Object} emailData
   * @returns {Promise<Object>}
   */
  async createEmailTransaction(emailData) {
    try {
      const {
        userId,
        integrationId,
        emailFrom,
        emailSubject,
        emailDate,
        emailMessageId,
        detectedType,
        detectedAmount,
        detectedCurrency = 'COP',
        detectedDescription,
        detectedCategory,
        detectedMerchant,
        confidenceScore,
        rawEmailBody,
        rawEmailSnippet,
        extractionJson,
      } = emailData;

      const result = await query(
        `INSERT INTO email_transactions (
          user_id, integration_id,
          email_from, email_subject, email_date, email_message_id,
          detected_type, detected_amount, detected_currency,
          detected_description, detected_category, detected_merchant,
          confidence_score,
          raw_email_body, raw_email_snippet, extraction_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (email_message_id) DO NOTHING
        RETURNING *`,
        [
          userId,
          integrationId,
          emailFrom,
          emailSubject,
          emailDate,
          emailMessageId,
          detectedType,
          detectedAmount,
          detectedCurrency,
          detectedDescription,
          detectedCategory,
          detectedMerchant,
          confidenceScore,
          rawEmailBody,
          rawEmailSnippet,
          extractionJson ? JSON.stringify(extractionJson) : null,
        ]
      );

      if (result.rows.length > 0) {
        Logger.success(`✅ Email transaction created: ${detectedDescription || emailSubject}`);
        return result.rows[0];
      } else {
        Logger.info(`ℹ️ Email transaction already exists (duplicate): ${emailMessageId}`);
        return null;
      }
    } catch (error) {
      Logger.error('Error creating email transaction', error);
      throw error;
    }
  }

  /**
   * Gets pending email transactions for user
   * @param {string} userId - User UUID
   * @param {number} limit - Max results
   * @returns {Promise<Array>}
   */
  async getPendingEmailTransactions(userId, limit = 10) {
    try {
      const result = await query(
        `SELECT * FROM email_transactions
         WHERE user_id = $1
           AND status = 'pending'
           AND user_confirmed IS NULL
         ORDER BY email_date DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error fetching pending email transactions', error);
      throw error;
    }
  }

  /**
   * Gets email transaction by ID
   * @param {string} emailTransactionId - Email transaction UUID
   * @returns {Promise<Object|null>}
   */
  async getEmailTransactionById(emailTransactionId) {
    try {
      const result = await query(
        `SELECT * FROM email_transactions WHERE email_transaction_id = $1`,
        [emailTransactionId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error fetching email transaction', error);
      throw error;
    }
  }

  /**
   * Confirms email transaction (user said "Yes")
   * @param {string} emailTransactionId - Email transaction UUID
   * @param {string} linkedTransactionId - Created transaction UUID
   * @returns {Promise<Object>}
   */
  async confirmEmailTransaction(emailTransactionId, linkedTransactionId) {
    try {
      const result = await query(
        `UPDATE email_transactions
         SET status = 'confirmed',
             user_confirmed = true,
             confirmed_at = CURRENT_TIMESTAMP,
             linked_transaction_id = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE email_transaction_id = $1
         RETURNING *`,
        [emailTransactionId, linkedTransactionId]
      );

      Logger.success(`✅ Email transaction confirmed: ${emailTransactionId}`);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error confirming email transaction', error);
      throw error;
    }
  }

  /**
   * Rejects email transaction (user said "No")
   * @param {string} emailTransactionId - Email transaction UUID
   * @param {string} reason - Rejection reason (optional)
   * @returns {Promise<Object>}
   */
  async rejectEmailTransaction(emailTransactionId, reason = null) {
    try {
      const result = await query(
        `UPDATE email_transactions
         SET status = 'rejected',
             user_confirmed = false,
             confirmed_at = CURRENT_TIMESTAMP,
             rejection_reason = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE email_transaction_id = $1
         RETURNING *`,
        [emailTransactionId, reason]
      );

      Logger.info(`ℹ️ Email transaction rejected: ${emailTransactionId}`);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error rejecting email transaction', error);
      throw error;
    }
  }

  /**
   * Marks email transaction as error
   * @param {string} emailTransactionId - Email transaction UUID
   * @param {string} errorReason - Error description
   * @returns {Promise<Object>}
   */
  async markAsError(emailTransactionId, errorReason) {
    try {
      const result = await query(
        `UPDATE email_transactions
         SET status = 'error',
             rejection_reason = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE email_transaction_id = $1
         RETURNING *`,
        [emailTransactionId, errorReason]
      );

      return result.rows[0];
    } catch (error) {
      Logger.error('Error marking email transaction as error', error);
      throw error;
    }
  }

  /**
   * Checks if email message ID already exists (duplicate detection)
   * @param {string} emailMessageId - Gmail message ID
   * @returns {Promise<boolean>}
   */
  async emailExists(emailMessageId) {
    try {
      const result = await query(
        `SELECT 1 FROM email_transactions WHERE email_message_id = $1 LIMIT 1`,
        [emailMessageId]
      );

      return result.rows.length > 0;
    } catch (error) {
      Logger.error('Error checking email existence', error);
      throw error;
    }
  }

  // ===================================
  // BANK PATTERNS
  // ===================================

  /**
   * Gets all active bank patterns
   * @returns {Promise<Array>}
   */
  async getBankPatterns() {
    try {
      const result = await query(
        `SELECT * FROM email_bank_patterns
         WHERE is_active = true
         ORDER BY priority DESC, bank_name ASC`
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error fetching bank patterns', error);
      throw error;
    }
  }

  /**
   * Finds matching bank pattern for email
   * @param {string} emailFrom - Email sender address
   * @returns {Promise<Object|null>}
   */
  async findBankPattern(emailFrom) {
    try {
      const result = await query(
        `SELECT * FROM find_bank_pattern($1)`,
        [emailFrom]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error finding bank pattern', error);
      throw error;
    }
  }

  /**
   * Checks if email is from a known financial institution
   * @param {string} emailFrom - Email sender address
   * @returns {Promise<boolean>}
   */
  async isFinancialEmail(emailFrom) {
    try {
      const result = await query(
        `SELECT is_financial_email($1) as is_financial`,
        [emailFrom]
      );

      return result.rows[0]?.is_financial || false;
    } catch (error) {
      Logger.error('Error checking if financial email', error);
      return false;
    }
  }

  /**
   * Gets email transaction statistics for user
   * @param {string} userId - User UUID
   * @returns {Promise<Object>}
   */
  async getEmailStats(userId) {
    try {
      const result = await query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
           COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
           COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
           COUNT(*) as total_count,
           AVG(confidence_score) as avg_confidence
         FROM email_transactions
         WHERE user_id = $1`,
        [userId]
      );

      return result.rows[0] || {
        pending_count: 0,
        confirmed_count: 0,
        rejected_count: 0,
        total_count: 0,
        avg_confidence: null,
      };
    } catch (error) {
      Logger.error('Error fetching email stats', error);
      throw error;
    }
  }
}

module.exports = new EmailDBService();
