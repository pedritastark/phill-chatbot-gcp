/**
 * Email Service
 *
 * Orchestrates the entire email-to-transaction flow:
 * 1. OAuth2 connection to Gmail
 * 2. Email synchronization (polling)
 * 3. Email parsing with AI
 * 4. WhatsApp confirmation requests
 * 5. Transaction creation upon user confirmation
 */

const GmailService = require('./gmail.service');
const AIService = require('./ai.service');
const WhatsappService = require('./whatsapp.service');
const EmailDBService = require('./db/email.db.service');
const UserDBService = require('./db/user.db.service');
const ConversationDBService = require('./db/conversation.db.service');
const Logger = require('../utils/logger');
const { gmailConfig } = require('../config/gmail.config');

class EmailService {
  /**
   * Connects user's Gmail account via OAuth2
   * @param {string} userId - User UUID
   * @param {string} authorizationCode - OAuth code from callback
   * @param {string} emailAddress - User's email address
   * @returns {Promise<Object>} - Created integration
   */
  async connectGmail(userId, authorizationCode, emailAddress) {
    try {
      Logger.info(`📧 Connecting Gmail for user ${userId}...`);

      // Exchange code for tokens
      const tokens = await GmailService.authenticate(authorizationCode);

      // Save integration to database
      const integration = await EmailDBService.createIntegration({
        userId,
        emailAddress,
        provider: 'gmail',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(tokens.expiry_date),
        syncFrequency: 'half_hourly',
        isActive: true,
      });

      Logger.success(`✅ Gmail connected successfully for ${emailAddress}`);

      return integration;
    } catch (error) {
      Logger.error('❌ Error connecting Gmail', error);
      throw new Error(`Failed to connect Gmail: ${error.message}`);
    }
  }

  /**
   * Disconnects user's Gmail integration
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>}
   */
  async disconnectGmail(userId) {
    try {
      Logger.info(`📧 Disconnecting Gmail for user ${userId}...`);

      await EmailDBService.deactivateIntegration(userId);

      Logger.success(`✅ Gmail disconnected for user ${userId}`);
      return true;
    } catch (error) {
      Logger.error('❌ Error disconnecting Gmail', error);
      throw error;
    }
  }

  /**
   * Synchronizes emails for a specific user
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} - Sync results
   */
  async syncEmails(userId) {
    try {
      Logger.info(`🔄 Starting email sync for user ${userId}...`);

      // Get user's integration
      const integration = await EmailDBService.getIntegrationByUserId(userId);

      if (!integration || !integration.is_active) {
        Logger.warning(`⚠️ No active Gmail integration for user ${userId}`);
        return {
          success: false,
          message: 'No active Gmail integration found',
        };
      }

      // Check if tokens need refresh
      let accessToken = integration.access_token;
      let refreshToken = integration.refresh_token;

      if (!GmailService.isTokenValid(accessToken, integration.token_expires_at)) {
        Logger.info('🔄 Access token expired, refreshing...');

        const newTokens = await GmailService.refreshAccessToken(refreshToken);
        accessToken = newTokens.access_token;

        // Update tokens in database
        await EmailDBService.updateTokens(integration.integration_id, {
          accessToken: newTokens.access_token,
          expiresAt: new Date(newTokens.expiry_date),
        });
      }

      // Get bank patterns to filter emails
      const bankPatterns = await EmailDBService.getBankPatterns();
      const fromPatterns = bankPatterns.map(p => p.email_pattern.replace(/%/g, ''));

      Logger.info(`🔍 Filtering by ${fromPatterns.length} bank patterns`);

      // Calculate date range for sync
      let afterDate = null;
      if (integration.last_sync_at) {
        afterDate = new Date(integration.last_sync_at);
      } else {
        // First sync - go back N days
        afterDate = new Date();
        afterDate.setDate(afterDate.getDate() - gmailConfig.sync.lookbackDays);
      }

      // Fetch messages from Gmail
      // Don't pass refreshToken to avoid unnecessary refresh attempts
      const gmailResponse = await GmailService.getMessages({
        accessToken,
        refreshToken: null,  // Don't pass refresh token - we already refreshed if needed above
        fromPatterns,
        maxResults: gmailConfig.sync.maxResults,
        afterDate,
      });

      const messages = gmailResponse.messages || [];
      Logger.info(`📨 Found ${messages.length} messages to process`);

      // Process each message
      let processedCount = 0;
      let newTransactionsCount = 0;

      for (const message of messages.slice(0, gmailConfig.sync.batchSize)) {
        try {
          const result = await this.processEmail(
            userId,
            integration.integration_id,
            accessToken,
            refreshToken,
            message.id
          );

          processedCount++;

          if (result && result.isNew) {
            newTransactionsCount++;
          }
        } catch (error) {
          Logger.error(`❌ Error processing message ${message.id}`, error);
          // Continue processing other messages
        }
      }

      // Update last sync timestamp
      await EmailDBService.updateLastSync(
        integration.integration_id,
        messages.length > 0 ? messages[0].id : null
      );

      Logger.success(
        `✅ Email sync completed: ${processedCount} processed, ${newTransactionsCount} new transactions`
      );

      return {
        success: true,
        messagesFound: messages.length,
        messagesProcessed: processedCount,
        newTransactions: newTransactionsCount,
      };
    } catch (error) {
      Logger.error('❌ Error syncing emails', error);
      throw error;
    }
  }

  /**
   * Processes a single email message
   * @param {string} userId - User UUID
   * @param {string} integrationId - Integration UUID
   * @param {string} accessToken - Gmail access token
   * @param {string} refreshToken - Gmail refresh token
   * @param {string} messageId - Gmail message ID
   * @returns {Promise<Object|null>} - Processing result
   */
  async processEmail(userId, integrationId, accessToken, refreshToken, messageId) {
    try {
      Logger.info(`📨 Processing email ${messageId}...`);

      // Check if already processed (duplicate detection)
      const exists = await EmailDBService.emailExists(messageId);
      if (exists) {
        Logger.info(`ℹ️ Email ${messageId} already processed (duplicate)`);
        return { isNew: false, reason: 'duplicate' };
      }

      // Fetch email content
      const email = await GmailService.getMessage({
        accessToken,
        refreshToken,
        messageId,
      });

      // Check if email is from known financial institution
      const isFinancial = await EmailDBService.isFinancialEmail(email.from);

      if (!isFinancial) {
        Logger.info(`ℹ️ Email from ${email.from} is not from a known bank - skipping`);
        return { isNew: false, reason: 'not_financial' };
      }

      Logger.info(`✅ Email from known bank: ${email.from}`);

      // Parse email with AI
      const parsed = await AIService.parseEmailTransaction(
        email.body,
        email.subject,
        email.from
      );

      // Validate parsed data
      if (parsed.type === 'unknown' || parsed.confidence < 0.5) {
        Logger.warning(`⚠️ Low confidence parsing (${parsed.confidence}) - skipping`);
        return { isNew: false, reason: 'low_confidence', parsed };
      }

      // Only process expenses and income (skip notifications, transfers)
      if (!['expense', 'income'].includes(parsed.type)) {
        Logger.info(`ℹ️ Email type '${parsed.type}' - not creating transaction`);
        return { isNew: false, reason: 'not_transaction_type', parsed };
      }

      // Save to database as pending
      const emailTransaction = await EmailDBService.createEmailTransaction({
        userId,
        integrationId,
        emailFrom: email.from,
        emailSubject: email.subject,
        emailDate: new Date(email.timestamp),
        emailMessageId: email.id,
        detectedType: parsed.type,
        detectedAmount: parsed.amount,
        detectedCurrency: parsed.currency,
        detectedDescription: parsed.description,
        detectedCategory: parsed.category,
        detectedMerchant: parsed.merchant,
        confidenceScore: parsed.confidence,
        rawEmailBody: email.body,
        rawEmailSnippet: email.snippet,
        extractionJson: parsed,
      });

      if (!emailTransaction) {
        // Already exists (duplicate)
        return { isNew: false, reason: 'duplicate' };
      }

      Logger.success(`✅ Email transaction created: ${emailTransaction.email_transaction_id}`);

      // Request user confirmation via WhatsApp
      await this.requestUserConfirmation(emailTransaction, userId);

      return {
        isNew: true,
        emailTransactionId: emailTransaction.email_transaction_id,
        parsed,
      };
    } catch (error) {
      Logger.error(`❌ Error processing email ${messageId}`, error);
      throw error;
    }
  }

  /**
   * Sends chatbot web confirmation request to user
   * @param {Object} emailTransaction - Email transaction from DB
   * @param {string} userId - User UUID
   * @returns {Promise<void>}
   */
  async requestUserConfirmation(emailTransaction, userId) {
    try {
      Logger.info(`📲 Requesting confirmation for email transaction ${emailTransaction.email_transaction_id}...`);

      // Get user data
      const user = await UserDBService.findById(userId);

      if (!user || !user.phone_number) {
        Logger.warning(`⚠️ No phone number for user ${userId}`);
        return;
      }

      // Format amount
      const formattedAmount = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: emailTransaction.detected_currency || 'COP',
        minimumFractionDigits: 0,
      }).format(emailTransaction.detected_amount);

      // Format date
      const date = new Date(emailTransaction.email_date);
      const formattedDate = new Intl.DateTimeFormat('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'America/Bogota',
      }).format(date);

      // Determine icon
      const icon = emailTransaction.detected_type === 'expense' ? '💸' : '💰';
      const typeText = emailTransaction.detected_type === 'expense' ? 'Gasto' : 'Ingreso';

      // Build message
      const message = `📧 Nueva transacción detectada de tu email:

${icon} ${typeText}: ${formattedAmount}
🏪 ${emailTransaction.detected_description || 'Sin descripción'}
📅 ${formattedDate}
🏦 De: ${emailTransaction.email_from}
${emailTransaction.detected_category ? `📂 Categoría: ${emailTransaction.detected_category}` : ''}

¿Deseas registrar esta transacción?

Responde "Sí" para confirmar o "No" para ignorar.

ID: ${emailTransaction.email_transaction_id}`;

      // Insert bot message into chat conversation (web chatbot)
      await ConversationDBService.addAssistantMessage(
        user.phone_number,
        message,
        {
          type: 'email_confirmation',
          email_transaction_id: emailTransaction.email_transaction_id,
        }
      );

      Logger.success(`✅ Confirmation request sent to chatbot for user ${user.phone_number}`);
    } catch (error) {
      Logger.error('❌ Error sending confirmation request', error);
      throw error;
    }
  }

  /**
   * Gets pending email transactions for user
   * @param {string} userId - User UUID
   * @param {number} limit - Max results
   * @returns {Promise<Array>}
   */
  async getPendingTransactions(userId, limit = 10) {
    try {
      return await EmailDBService.getPendingEmailTransactions(userId, limit);
    } catch (error) {
      Logger.error('Error fetching pending email transactions', error);
      throw error;
    }
  }

  /**
   * Gets email integration status for user
   * @param {string} userId - User UUID
   * @returns {Promise<Object>}
   */
  async getIntegrationStatus(userId) {
    try {
      const integration = await EmailDBService.getIntegrationByUserId(userId);
      const stats = await EmailDBService.getEmailStats(userId);

      return {
        connected: !!integration && integration.is_active,
        emailAddress: integration?.email_address || null,
        lastSync: integration?.last_sync_at || null,
        stats: {
          pending: parseInt(stats.pending_count) || 0,
          confirmed: parseInt(stats.confirmed_count) || 0,
          rejected: parseInt(stats.rejected_count) || 0,
          total: parseInt(stats.total_count) || 0,
          avgConfidence: parseFloat(stats.avg_confidence) || 0,
        },
      };
    } catch (error) {
      Logger.error('Error getting integration status', error);
      throw error;
    }
  }

  /**
   * Syncs all active integrations (called by scheduler)
   * @returns {Promise<Object>}
   */
  async syncAllActiveIntegrations() {
    try {
      Logger.info('🔄 Starting sync for all active integrations...');

      const integrations = await EmailDBService.getActiveIntegrations();

      Logger.info(`📊 Found ${integrations.length} active integrations`);

      let successCount = 0;
      let errorCount = 0;

      for (const integration of integrations) {
        try {
          await this.syncEmails(integration.user_id);
          successCount++;
        } catch (error) {
          Logger.error(`❌ Error syncing for user ${integration.user_id}`, error);
          errorCount++;
        }
      }

      Logger.success(`✅ Batch sync completed: ${successCount} success, ${errorCount} errors`);

      return {
        total: integrations.length,
        success: successCount,
        errors: errorCount,
      };
    } catch (error) {
      Logger.error('❌ Error syncing all integrations', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
