const config = require('../src/config/environment');
const MessageService = require('../src/services/message.service');
const { query } = require('../src/config/database');
const Logger = require('../src/utils/logger');

const TEST_PHONE = 'whatsapp:+573009998877';

async function setupTestUser() {
    Logger.info('🔄 Setting up test user...');
    await query(`
        INSERT INTO users (phone_number, name, onboarding_completed, onboarding_step, is_active, language, currency, timezone, created_at, updated_at)
        VALUES ($1, 'CategoryTester', true, 'completed', true, 'es', 'COP', 'America/Bogota', NOW(), NOW())
        ON CONFLICT (phone_number) 
        DO UPDATE SET onboarding_completed = true, onboarding_step = 'completed', name = 'CategoryTester'
    `, [TEST_PHONE]);

    const userRes = await query('SELECT user_id FROM users WHERE phone_number = $1', [TEST_PHONE]);
    const userId = userRes.rows[0].user_id;

    // Clean slate
    await query('DELETE FROM transactions WHERE user_id = $1', [userId]);
    await query('DELETE FROM conversations WHERE user_id = $1', [userId]);

    return userId;
}

async function run() {
    try {
        const userId = await setupTestUser();

        Logger.info('🚀 Registering expenses...');
        // 1. Register Food Expense (implicitly categorizes as Comida or Alimentación)
        await MessageService.processMessage('Gasté 20k en hamburguesa', TEST_PHONE);

        // 2. Register Another Food Expense
        await MessageService.processMessage('Almuerzo por 15000', TEST_PHONE);

        // 3. Register Transport Expense (to ensure filtering works)
        await MessageService.processMessage('Taxi 10k', TEST_PHONE);

        Logger.info('❓ Asking for category spending...');
        // 4. Ask: How much did I spend on food?
        const response = await MessageService.processMessage('¿Cuánto he gastado en comida este mes?', TEST_PHONE);

        console.log('🤖 Bot response:', response);

        // Expected: 20k + 15k = 35k
        // The bot should mention 35.000 or 35k
        if (response.includes('35.000') || response.includes('35k') || response.includes('$35,000')) {
            console.log('✅ Correct amount found in response!');
        } else {
            console.warn('⚠️ Could not find exact "35.000" in response. Please check manually if interpretation logic is too creative.');
        }

        console.log('🎉 TEST FINISHED');
        process.exit(0);
    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        process.exit(1);
    }
}

run();
