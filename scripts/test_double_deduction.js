const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { FinanceService } = require('../src/services/finance.service');
const MessageService = require('../src/services/message.service');

// REVERTED: We need DATABASE_URL because it points to the correct DB with schema
// delete process.env.DATABASE_URL;

const { query } = require('../src/config/database');
const Logger = require('../src/utils/logger');

const TEST_PHONE = 'whatsapp:+573009998877';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    try {
        Logger.info('🚀 Starting Double Deduction Test...');

        // Debug connection
        const { config } = require('../src/config/environment');
        console.log('🔌 DB Config:', {
            host: process.env.DB_HOST || config.database.host,
            database: process.env.DB_NAME || config.database.database
        });

        // Debug Column Availability
        try {
            await query("SELECT onboarding_step FROM users LIMIT 1");
            console.log('✅ Column onboarding_step exists and is accessible.');
        } catch (e) {
            console.error('❌ Column onboarding_step access failed:', e.message);
        }

        // 1. Reset transactions/accounts but KEEP user and FORCE onboarding completion
        const uidRes = await query("SELECT user_id FROM users WHERE phone_number = $1", [TEST_PHONE]);
        if (uidRes.rows.length > 0) {
            const uid = uidRes.rows[0].user_id;
            await query('DELETE FROM transactions WHERE user_id = $1', [uid]);
            await query('DELETE FROM accounts WHERE user_id = $1', [uid]);

            // Force user to be fully onboarded to skip OnboardingService
            await query("UPDATE users SET onboarding_completed = true, onboarding_data = '{}', is_active = true WHERE user_id = $1", [uid]);

            // Create 'Banco' account explicitly so the bot can find it
            await query("INSERT INTO accounts (user_id, name, type, balance, is_active) VALUES ($1, 'Banco', 'savings', 0, true)", [uid]);
        } else {
            // Create user if missing
            const newUidRes = await query(`INSERT INTO users (phone_number, name, onboarding_completed, is_active) VALUES ($1, 'TestUser', true, true) ON CONFLICT DO NOTHING RETURNING user_id`, [TEST_PHONE]);
            if (newUidRes.rows.length > 0) {
                const newUid = newUidRes.rows[0].user_id;
                await query("INSERT INTO accounts (user_id, name, type, balance, is_active) VALUES ($1, 'Banco', 'savings', 0, true)", [newUid]);
            }
        }

        // 2. Set initial balance (Income)
        console.log("--- 1. Setting Initial Income (1,000,000) ---");
        // We use explicit account 'Banco' to ensure we have one
        const res0 = await MessageService.processMessage('Gané 1000000 en Banco', TEST_PHONE);
        console.log('Bot:', res0);
        await sleep(2000);

        // Verify balance is 1,000,000
        const bal1 = await query(`
            SELECT a.balance 
            FROM accounts a 
            JOIN users u ON a.user_id = u.user_id 
            WHERE u.phone_number = $1 AND a.name = 'Banco'`, [TEST_PHONE]);

        const initialBalance = parseFloat(bal1.rows[0].balance);
        console.log(`✅ Balance Inicial: ${initialBalance}`);

        if (initialBalance !== 1000000) {
            throw new Error(`Balance incorrecto. Esperado: 1000000, Actual: ${initialBalance}`);
        }

        // 3. Register Expense (10,000)
        console.log("--- 2. Registering Expense (10,000) ---");
        // "Gaste 10k en perro caliente" -> Should catalyze as Alimentación
        // And specify 'Banco' directly to avoid conversation flow complexity in this unit test
        // Or if we want to test the conversation interaction, we should do two steps.
        // Let's do the single step first to verify the FinanceService fix cleanly.
        const res1 = await MessageService.processMessage('Gaste 10k en perro caliente en Banco', TEST_PHONE);
        console.log('Bot:', res1);
        await sleep(2000);

        // 4. Verify Balance
        const bal2 = await query(`
            SELECT a.balance 
            FROM accounts a 
            JOIN users u ON a.user_id = u.user_id 
            WHERE u.phone_number = $1 AND a.name = 'Banco'`, [TEST_PHONE]);

        const finalBalance = parseFloat(bal2.rows[0].balance);
        console.log(`✅ Balance Final: ${finalBalance}`);

        const expected = 990000;

        if (finalBalance === 980000) {
            console.error('❌ FAILURE: Double deduction detected! Balance is 980k.');
            process.exit(1);
        } else if (finalBalance === expected) {
            console.log('🎉 SUCCESS: Balance is exactly 990k. Double deduction fixed.');
        } else {
            console.error(`❌ FAILURE: Unexpected balance. Expected ${expected}, got ${finalBalance}`);
            process.exit(1);
        }

        process.exit(0);

    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

runTest();
