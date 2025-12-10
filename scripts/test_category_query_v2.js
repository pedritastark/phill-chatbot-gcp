const config = require('../src/config/environment');
const MessageService = require('../src/services/message.service');
const { query } = require('../src/config/database');
const Logger = require('../src/utils/logger');

const TEST_PHONE = 'whatsapp:+573009998877';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

        // 0. Initial Income
        console.log("--- Sending Message 0 (Income) ---");
        await MessageService.processMessage('Gané 1000000 en efectivo', TEST_PHONE);
        await sleep(2000);

        // 1. Food Expense
        console.log("--- Sending Message 1 ---");
        let res1 = await MessageService.processMessage('Gasté 20k en hamburguesa', TEST_PHONE);
        console.log('🤖 Bot response 1:', res1);

        // Check DB immediately
        const check1 = await query('SELECT count(*) FROM transactions WHERE user_id = $1', [userId]);
        console.log('Moved to verification: Count after msg 1:', check1.rows[0].count);

        await sleep(2000); // Wait for processing

        // 2. Another Food Expense
        console.log("--- Sending Message 2 ---");
        let res2 = await MessageService.processMessage('Almuerzo por 15000', TEST_PHONE);
        console.log('🤖 Bot response 2:', res2);
        await sleep(2000);

        // 3. Transport Expense
        console.log("--- Sending Message 3 ---");
        let res3 = await MessageService.processMessage('Taxi 10k', TEST_PHONE);
        console.log('🤖 Bot response 3:', res3);
        await sleep(2000);

        Logger.info('❓ Asking for category spending...');
        // 4. Query
        const response = await MessageService.processMessage('¿Cuánto he gastado en comida este mes?', TEST_PHONE);

        console.log('🤖 Bot response:', response);

        // Expected: 20k + 15k = 35k
        if (response.includes('35.000') || response.includes('35k') || response.includes('$35,000')) {
            console.log('✅ Correct amount (35k) found in response!');
        } else {
            console.warn('⚠️ Could not find "35.000" in response.');
        }

        console.log('🎉 TEST FINISHED');
        process.exit(0);
    } catch (error) {
        console.error('❌ TEST FAILED:', error);
        process.exit(1);
    }
}

run();
