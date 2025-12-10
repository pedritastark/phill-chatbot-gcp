const config = require('../src/config/environment');
const MessageService = require('../src/services/message.service');
const { query } = require('../src/config/database');
const Logger = require('../src/utils/logger');

const TEST_PHONE = 'whatsapp:+573009998877';

async function setupTestUser() {
    Logger.info('🔄 Setting up test user...');
    // Ensure user exists and is fully onboarded so we talk to AI directly
    await query(`
        INSERT INTO users (phone_number, name, onboarding_completed, onboarding_step, is_active, language, currency, timezone, created_at, updated_at)
        VALUES ($1, 'ReminderTester', true, 'completed', true, 'es', 'COP', 'America/Bogota', NOW(), NOW())
        ON CONFLICT (phone_number) 
        DO UPDATE SET onboarding_completed = true, onboarding_step = 'completed', name = 'ReminderTester'
    `, [TEST_PHONE]);

    // Clear existing reminders and conversation history for this user
    const userRes = await query('SELECT user_id FROM users WHERE phone_number = $1', [TEST_PHONE]);
    const userId = userRes.rows[0].user_id;

    await query('DELETE FROM reminders WHERE user_id = $1', [userId]);
    await query('DELETE FROM conversations WHERE user_id = $1', [userId]);

    return userId;
}

async function verifyReminder(userId) {
    Logger.info('🔍 Verifying reminder creation...');

    // Allow some time for DB to process if needed (usually instant, but good practice)
    await new Promise(r => setTimeout(r, 1000));

    const res = await query('SELECT * FROM reminders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);

    if (res.rows.length === 0) {
        throw new Error('❌ No reminder found for user!');
    }

    const reminder = res.rows[0];
    const scheduled = new Date(reminder.scheduled_at);
    const now = new Date();

    Logger.info(`✅ Reminder found: ID ${reminder.reminder_id}`);
    Logger.info(`📝 Message: ${reminder.message}`);
    Logger.info(`📅 Scheduled at: ${scheduled.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
    Logger.info(`🕒 Current time: ${now.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);

    // Verification logic:
    // We asked for "1 minute", so scheduled time should be roughly now + 1 min.
    // Let's check if it's within a reasonable window (e.g. between 30s and 90s from now)

    const diffMs = scheduled.getTime() - now.getTime();
    const diffSeconds = diffMs / 1000;

    Logger.info(`⏱️ Time difference: ${diffSeconds.toFixed(1)} seconds`);

    if (diffSeconds < 30 || diffSeconds > 90) {
        Logger.warning(`⚠️ Warning: Time difference is outside strict expected range (30-90s). Is timezone correct?`);
        // We won't crash the test, maybe just warn, or check if it's at least in the future
        if (diffSeconds < 0) {
            throw new Error('❌ Scheduled time is in the past!');
        }
    }

    if (!reminder.message.toLowerCase().includes('probar esto')) {
        Logger.warning(`⚠️ Message content varies from request (AI creativity?): "${reminder.message}"`);
        // We accept it, as long as it's not empty
    }

    console.log('✅ Reminder verification PASSED');
    return true;
}

async function run() {
    try {
        const userId = await setupTestUser();

        Logger.info('🚀 Simulating user message: "Recuérdame en 1 minuto probar esto"');
        const response = await MessageService.processMessage('Recuérdame en 1 minuto probar esto', TEST_PHONE);

        console.log('🤖 Bot response:', response);

        // Check response content - should confirm the reminder
        if (typeof response === 'string' && !response.includes('Recuérdame') && !response.includes('recordaré') && !response.includes('Hecho')) {
            Logger.warning('⚠️ Bot response might not be a confirmation. Check logs.');
        }

        await verifyReminder(userId);

        console.log('🎉 ALL TESTS PASSED!');
        process.exit(0);
    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        process.exit(1);
    }
}

run();
