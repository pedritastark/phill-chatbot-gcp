/**
 * Email Scheduler Service
 *
 * Runs periodic email synchronization for all active integrations.
 * Default: Every 30 minutes
 */

const cron = require('node-cron');
const { DateTime } = require('luxon');
const Logger = require('../utils/logger');
const EmailService = require('./email.service');
const { isSyncEnabled, gmailConfig } = require('../config/gmail.config');

class EmailScheduler {
  constructor() {
    this.cronTask = null;
    this.isRunning = false;
  }

  /**
   * Initializes the email sync cron job
   */
  init() {
    // Check if email sync is enabled
    if (!isSyncEnabled()) {
      Logger.warning('⚠️ Email sync is disabled (missing Gmail configuration)');
      Logger.info('💡 Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and EMAIL_SYNC_ENABLED=true to enable');
      return;
    }

    Logger.info('⏳ Initializing Email Scheduler Service...');

    // Determine cron schedule based on config
    const intervalMinutes = gmailConfig.sync.intervalMinutes;
    let cronSchedule;

    switch (intervalMinutes) {
      case 15:
        cronSchedule = '*/15 * * * *'; // Every 15 minutes
        break;
      case 30:
        cronSchedule = '*/30 * * * *'; // Every 30 minutes
        break;
      case 60:
        cronSchedule = '0 * * * *'; // Every hour
        break;
      default:
        cronSchedule = '*/30 * * * *'; // Default: 30 minutes
    }

    Logger.info(`📅 Email sync schedule: Every ${intervalMinutes} minutes (${cronSchedule})`);

    // Schedule cron job
    this.cronTask = cron.schedule(
      cronSchedule,
      async () => {
        await this.runSync();
      },
      {
        scheduled: true,
        timezone: 'America/Bogota',
      }
    );

    Logger.success(`✅ Email Scheduler active: Every ${intervalMinutes} minutes (America/Bogota)`);

    // Run initial sync after 30 seconds (give server time to start)
    setTimeout(() => {
      Logger.info('🚀 Running initial email sync...');
      this.runSync();
    }, 30000);
  }

  /**
   * Runs email sync for all active integrations
   */
  async runSync() {
    // Prevent concurrent runs
    if (this.isRunning) {
      Logger.warning('⚠️ Email sync already running, skipping this cycle');
      return;
    }

    this.isRunning = true;

    try {
      const now = DateTime.now().setZone('America/Bogota').toFormat('yyyy-MM-dd HH:mm:ss');

      Logger.info('═══════════════════════════════════════════════');
      Logger.info(`🕐 [EmailScheduler] Running sync at ${now}`);
      Logger.info('═══════════════════════════════════════════════');

      const startTime = Date.now();

      // Run sync for all active integrations
      const results = await EmailService.syncAllActiveIntegrations();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      Logger.info('───────────────────────────────────────────────');
      Logger.success(`✅ Email sync completed in ${duration}s`);
      Logger.info(`📊 Results: ${results.total} integrations, ${results.success} success, ${results.errors} errors`);
      Logger.info('═══════════════════════════════════════════════');
    } catch (error) {
      Logger.error('❌ Error running email sync scheduler', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually triggers a sync (for testing or admin actions)
   */
  async triggerManualSync() {
    Logger.info('🔧 Manual email sync triggered');
    await this.runSync();
  }

  /**
   * Stops the scheduler
   */
  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      Logger.info('🛑 Email Scheduler stopped');
    }
  }

  /**
   * Starts the scheduler (if stopped)
   */
  start() {
    if (this.cronTask) {
      this.cronTask.start();
      Logger.success('▶️ Email Scheduler started');
    }
  }

  /**
   * Gets scheduler status
   * @returns {Object}
   */
  getStatus() {
    return {
      enabled: isSyncEnabled(),
      running: this.isRunning,
      scheduled: !!this.cronTask,
      intervalMinutes: gmailConfig.sync.intervalMinutes,
    };
  }
}

module.exports = new EmailScheduler();
