/**
 * Gmail Service
 *
 * Handles Gmail API interactions via OAuth2.
 * Supports:
 * - OAuth2 authentication flow
 * - Token management (access + refresh tokens)
 * - Email fetching with filters
 * - Rate limiting and retry logic
 */

const { google } = require('googleapis');
const Logger = require('../utils/logger');
const { gmailConfig } = require('../config/gmail.config');

/**
 * Creates OAuth2 client instance
 * @returns {OAuth2Client}
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    gmailConfig.clientId,
    gmailConfig.clientSecret,
    gmailConfig.redirectUri
  );
}

/**
 * Exchanges authorization code for access & refresh tokens
 * @param {string} authorizationCode - Code from OAuth callback
 * @returns {Promise<Object>} - { access_token, refresh_token, expiry_date }
 */
async function authenticate(authorizationCode) {
  try {
    Logger.info('🔐 Authenticating with Gmail OAuth2...');

    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(authorizationCode);

    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }

    Logger.success('✅ Gmail OAuth2 authentication successful');

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      token_type: tokens.token_type,
    };
  } catch (error) {
    Logger.error('❌ Gmail OAuth2 authentication failed', error);
    throw new Error(`Gmail authentication failed: ${error.message}`);
  }
}

/**
 * Refreshes access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} - { access_token, expiry_date }
 */
async function refreshAccessToken(refreshToken) {
  try {
    Logger.info('🔄 Refreshing Gmail access token...');

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    Logger.success('✅ Gmail access token refreshed');

    return {
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
    };
  } catch (error) {
    Logger.error('❌ Failed to refresh Gmail access token', error);
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

/**
 * Creates Gmail API client with credentials
 * @param {string} accessToken - Current access token
 * @param {string} refreshToken - Refresh token (optional)
 * @returns {gmail_v1.Gmail}
 */
function createGmailClient(accessToken, refreshToken = null) {
  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Fetches messages from Gmail with filters
 * @param {Object} params
 * @param {string} params.accessToken - Access token
 * @param {string} params.refreshToken - Refresh token (optional)
 * @param {string[]} params.fromPatterns - Array of email patterns to filter by (e.g., ['@bancolombia.com'])
 * @param {number} params.maxResults - Maximum number of messages to fetch (default: 50)
 * @param {string} params.afterMessageId - Fetch messages after this ID (pagination)
 * @param {Date} params.afterDate - Fetch messages after this date
 * @returns {Promise<Object>} - { messages: [], nextPageToken, resultSizeEstimate }
 */
async function getMessages({
  accessToken,
  refreshToken = null,
  fromPatterns = [],
  maxResults = 50,
  afterMessageId = null,
  afterDate = null,
}) {
  try {
    Logger.info(`📧 Fetching Gmail messages (max: ${maxResults})...`);

    const gmail = createGmailClient(accessToken, refreshToken);

    // Build Gmail search query
    const queryParts = [];

    // Filter by sender patterns
    if (fromPatterns.length > 0) {
      const fromQuery = fromPatterns
        .map(pattern => `from:${pattern}`)
        .join(' OR ');
      queryParts.push(`(${fromQuery})`);
    }

    // Filter by date (Gmail format: after:YYYY/MM/DD)
    if (afterDate) {
      const dateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/');
      queryParts.push(`after:${dateStr}`);
    }

    // Only unread messages (optional - can be removed if we want all messages)
    // queryParts.push('is:unread');

    const query = queryParts.join(' ');

    Logger.info(`🔍 Gmail query: ${query || 'all messages'}`);

    // Fetch message list
    const listParams = {
      userId: 'me',
      maxResults: Math.min(maxResults, gmailConfig.sync.maxResults),
      q: query || undefined,
    };

    const response = await gmail.users.messages.list(listParams);

    const messages = response.data.messages || [];

    Logger.success(`✅ Found ${messages.length} Gmail messages`);

    return {
      messages: messages.map(msg => ({
        id: msg.id,
        threadId: msg.threadId,
      })),
      nextPageToken: response.data.nextPageToken,
      resultSizeEstimate: response.data.resultSizeEstimate || messages.length,
    };
  } catch (error) {
    Logger.error('❌ Failed to fetch Gmail messages', error);

    // Handle specific error cases
    if (error.code === 401) {
      throw new Error('Gmail authentication expired. Please reconnect your account.');
    }

    if (error.code === 403) {
      throw new Error('Gmail API quota exceeded. Please try again later.');
    }

    throw new Error(`Failed to fetch Gmail messages: ${error.message}`);
  }
}

/**
 * Fetches full message content by ID
 * @param {Object} params
 * @param {string} params.accessToken - Access token
 * @param {string} params.refreshToken - Refresh token (optional)
 * @param {string} params.messageId - Gmail message ID
 * @returns {Promise<Object>} - Parsed email data
 */
async function getMessage({ accessToken, refreshToken = null, messageId }) {
  try {
    Logger.info(`📨 Fetching Gmail message: ${messageId}`);

    const gmail = createGmailClient(accessToken, refreshToken);

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',  // Get full message including body
    });

    const message = response.data;

    // Parse message data
    const headers = message.payload.headers;
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : null;
    };

    // Extract email body
    let emailBody = '';
    let emailSnippet = message.snippet || '';

    if (message.payload.parts) {
      // Multipart email
      const textPart = message.payload.parts.find(
        part => part.mimeType === 'text/plain'
      );
      if (textPart && textPart.body.data) {
        emailBody = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    } else if (message.payload.body.data) {
      // Single part email
      emailBody = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }

    // Fallback to snippet if body is empty
    if (!emailBody || emailBody.trim().length === 0) {
      emailBody = emailSnippet;
    }

    const parsedMessage = {
      id: message.id,
      threadId: message.threadId,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      timestamp: parseInt(message.internalDate),
      snippet: emailSnippet,
      body: emailBody,
      labelIds: message.labelIds || [],
    };

    Logger.success(`✅ Fetched message from: ${parsedMessage.from}`);

    return parsedMessage;
  } catch (error) {
    Logger.error(`❌ Failed to fetch Gmail message ${messageId}`, error);

    if (error.code === 401) {
      throw new Error('Gmail authentication expired. Please reconnect your account.');
    }

    throw new Error(`Failed to fetch Gmail message: ${error.message}`);
  }
}

/**
 * Executes function with retry logic (for rate limiting)
 * @param {Function} fn - Async function to execute
 * @param {number} attempts - Number of retry attempts
 * @returns {Promise<any>}
 */
async function withRetry(fn, attempts = gmailConfig.rateLimits.retryAttempts) {
  let lastError;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on auth errors
      if (error.code === 401 || error.code === 403) {
        throw error;
      }

      if (i < attempts - 1) {
        const delay = gmailConfig.rateLimits.retryDelayMs *
          Math.pow(gmailConfig.rateLimits.backoffMultiplier, i);

        Logger.warning(`⚠️ Retry ${i + 1}/${attempts} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Validates OAuth tokens
 * @param {string} accessToken - Access token
 * @param {number} expiryDate - Token expiry timestamp (milliseconds)
 * @returns {boolean} - True if token is valid and not expired
 */
function isTokenValid(accessToken, expiryDate) {
  if (!accessToken) {
    return false;
  }

  if (!expiryDate) {
    return true; // Assume valid if no expiry date
  }

  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5 minutes buffer

  return now < (expiryDate - buffer);
}

module.exports = {
  authenticate,
  refreshAccessToken,
  getMessages,
  getMessage,
  withRetry,
  isTokenValid,
  createOAuth2Client,
};
