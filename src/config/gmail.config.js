/**
 * Gmail API Configuration
 *
 * OAuth2 credentials and settings for Gmail integration.
 *
 * Environment variables required:
 * - GMAIL_CLIENT_ID: OAuth2 client ID from Google Cloud Console
 * - GMAIL_CLIENT_SECRET: OAuth2 client secret
 * - GMAIL_REDIRECT_URI: Redirect URI after OAuth consent (must match GCP settings)
 *
 * Setup instructions:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project or select existing
 * 3. Enable Gmail API
 * 4. Create OAuth2 credentials (Web application)
 * 5. Add authorized redirect URIs
 * 6. Copy Client ID and Client Secret to .env
 */

const Logger = require('../utils/logger');

// Gmail API OAuth2 Configuration
const gmailConfig = {
  clientId: process.env.GMAIL_CLIENT_ID,
  clientSecret: process.env.GMAIL_CLIENT_SECRET,
  redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/v1/email/callback',

  // OAuth2 Scopes
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',  // Read emails (includes metadata)
  ],

  // Email sync configuration
  sync: {
    enabled: process.env.EMAIL_SYNC_ENABLED === 'true',
    intervalMinutes: parseInt(process.env.EMAIL_SYNC_INTERVAL || '30'),
    lookbackDays: parseInt(process.env.EMAIL_LOOKBACK_DAYS || '7'),
    maxResults: parseInt(process.env.EMAIL_MAX_RESULTS || '50'),
    batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '10'),
  },

  // Rate limiting (Gmail API quotas)
  rateLimits: {
    quotaUserPerSecond: 250,  // Gmail API limit
    quotaPerDay: 1000000000,  // 1 billion quota units/day
    retryAttempts: 3,
    retryDelayMs: 1000,
    backoffMultiplier: 2,
  },
};

/**
 * Validates Gmail configuration
 * @returns {boolean} - True if configuration is valid
 */
function validateGmailConfig() {
  const required = ['clientId', 'clientSecret', 'redirectUri'];
  const missing = required.filter(field => !gmailConfig[field]);

  if (missing.length > 0) {
    Logger.warning(`⚠️ Gmail config incomplete. Missing: ${missing.join(', ')}`);
    Logger.info('💡 Email sync will be disabled. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REDIRECT_URI to enable.');
    return false;
  }

  return true;
}

/**
 * Gets OAuth2 authorization URL
 * @param {string} state - State parameter for CSRF protection
 * @returns {string} - Authorization URL
 */
function getAuthUrl(state = '') {
  const params = new URLSearchParams({
    client_id: gmailConfig.clientId,
    redirect_uri: gmailConfig.redirectUri,
    response_type: 'code',
    scope: gmailConfig.scopes.join(' '),
    access_type: 'offline',  // Get refresh token
    prompt: 'consent',  // Force consent screen to get refresh token
    state: state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Checks if Gmail sync is enabled
 * @returns {boolean}
 */
function isSyncEnabled() {
  return gmailConfig.sync.enabled && validateGmailConfig();
}

module.exports = {
  gmailConfig,
  validateGmailConfig,
  getAuthUrl,
  isSyncEnabled,
};
