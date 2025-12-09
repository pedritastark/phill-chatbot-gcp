const config = require('../src/config/environment');
const OnboardingService = require('../src/services/onboarding.service');
const { query } = require('../src/config/database');
const Logger = require('../src/utils/logger');

const TEST_PHONE = 'whatsapp:+573009998877';

async function setupTestUser() {
    Logger.info('🔄 Setting up test user...');
    // Reset user to 'reminder_setup' step
    await query(`
        INSERT INTO users (phone_number, name, onboarding_step, is_active, language, currency, timezone, created_at, updated_at)
        VALUES ($1, 'ReminderTester', 'reminder_setup', true, 'es', 'COP', 'America/Bogota', NOW(), NOW())
        ON CONFLICT (phone_number) 
        DO UPDATE SET onboarding_step = 'reminder_setup', onboarding_completed = false
    `, [TEST_PHONE]);

    // Clear existing reminders for this user
    const userRes = await query('SELECT user_id FROM users WHERE phone_number = $1', [TEST_PHONE]);
    const userId = userRes.rows[0].user_id;
    await query('DELETE FROM reminders WHERE user_id = $1', [userId]);

    return userId;
}

async function verifyReminder(userId) {
    Logger.info('🔍 Verifying reminder creation...');
    const res = await query('SELECT * FROM reminders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);

    if (res.rows.length === 0) {
        throw new Error('❌ No reminder found for user!');
    }

    const reminder = res.rows[0];
    const scheduled = new Date(reminder.scheduled_at);

    Logger.info(`✅ Reminder found: ID ${reminder.reminder_id}`);
    Logger.info(`📅 Scheduled at: ${scheduled.toLocaleString()}`);

    if (scheduled.getHours() !== 20) {
        throw new Error(`❌ Schedued time wrong! Expected 20:00 (8 PM), got ${scheduled.getHours()}:${scheduled.getMinutes()}`);
    }

    console.log('✅ Reminder verification PASSED');
    return true;
}

async function verifyUserStatus(userId) {
    Logger.info('🔍 Verifying user completion status...');
    const res = await query('SELECT onboarding_completed, onboarding_step FROM users WHERE user_id = $1', [userId]);
    const user = res.rows[0];

    if (!user.onboarding_completed || user.onboarding_step !== 'completed') {
        throw new Error(`❌ User status wrong! Completed: ${user.onboarding_completed}, Step: ${user.onboarding_step}`);
    }

    console.log('✅ User status verification PASSED');
}

async function run() {
    try {
        const userId = await setupTestUser();

        Logger.info('🚀 Simulating user message...');
        const response = await OnboardingService.processMessage(TEST_PHONE, '¡De una!');

        console.log('🤖 Bot response:', response);

        if (!response.includes('¡Genial!')) {
            throw new Error('Unexpected bot response');
        }

        await verifyReminder(userId);
        await verifyUserStatus(userId);

        console.log('🎉 ALL TESTS PASSED!');
        process.exit(0);
    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        process.exit(1);
    }
}

run();
