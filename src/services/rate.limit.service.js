const { config } = require('../config/environment');
const Logger = require('../utils/logger');

class RateLimitService {
    constructor() {
        this.userTimestamps = new Map(); // Stores last message timestamp per user
        this.userDailyCounts = new Map(); // Stores daily message count per user
        this.lastCleanup = Date.now();
    }

    /**
     * Checks if a user is allowed to send a message based on rate limits and daily quotas.
     * @param {string} userId - The user's phone number.
     * @returns {Object} - { allowed: boolean, reason: string }
     */
    checkLimit(userId) {
        const now = Date.now();

        // 1. Check Rate Limit (Spam Protection)
        const lastMessageTime = this.userTimestamps.get(userId) || 0;
        if (now - lastMessageTime < config.security.rateLimitWindowMs) {
            Logger.warning(`🚫 Rate limit exceeded for ${userId}`);
            return { allowed: false, reason: 'rate_limit' };
        }

        // 2. Check Daily Limit (Cost Control)
        this.cleanupDailyCounts(now); // Ensure we are counting for the current day

        let dailyCount = this.userDailyCounts.get(userId) || 0;
        if (dailyCount >= config.security.dailyMessageLimit) {
            Logger.warning(`🚫 Daily limit exceeded for ${userId} (${dailyCount}/${config.security.dailyMessageLimit})`);
            return { allowed: false, reason: 'daily_limit' };
        }

        // Update state
        this.userTimestamps.set(userId, now);
        this.userDailyCounts.set(userId, dailyCount + 1);

        return { allowed: true };
    }

    /**
     * Resets daily counts if a new day has started.
     * Simple implementation: checks if 24h have passed since last cleanup.
     * For production, a cron job or Redis expiry is better.
     */
    cleanupDailyCounts(now) {
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (now - this.lastCleanup > oneDayMs) {
            Logger.info('🧹 Resetting daily rate limit counts');
            this.userDailyCounts.clear();
            this.lastCleanup = now;
        }
    }
}

module.exports = new RateLimitService();
