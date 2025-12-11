require('dotenv').config();
const { Pool } = require('pg');
const OnboardingService = require('../src/services/onboarding.service');
const UserDBService = require('../src/services/db/user.db.service');
const AccountDBService = require('../src/services/db/account.db.service');

// Setup DB
if (process.env.DATABASE_URL) {
    try {
        const url = new URL(process.env.DATABASE_URL);
        process.env.DB_HOST = url.hostname;
        process.env.DB_PORT = url.port;
        process.env.DB_USER = url.username;
        process.env.DB_PASSWORD = url.password;
        process.env.DB_NAME = url.pathname.slice(1);
    } catch (err) { }
}

const TEST_PHONE = 'whatsapp:+573000000000';

async function runSimulation() {
    console.log('🚀 Starting Onboarding Simulation...');

    // 1. Reset User
    console.log('🧹 Resetting test user...');
    await UserDBService.updateUser(TEST_PHONE, {
        onboarding_completed: false,
        onboarding_step: 'name_input',
        onboarding_data: { step: 'name_input' },
        name: null,
        financial_goal_level: 1,
        risk_tolerance: 'medium',
        financial_diagnosis: null
    });

    // Clean accounts
    const user = await UserDBService.findByPhoneNumber(TEST_PHONE);
    if (user) {
        const accounts = await AccountDBService.findByUser(user.user_id);
        for (const acc of accounts) await AccountDBService.delete(acc.account_id);
    } else {
        console.error('Test user needs to exist first. Run manual creation if needed.');
        process.exit(1);
    }

    // Function to simulate user message
    async function userSays(text) {
        console.log(`\n👤 User: "${text}"`);
        const response = await OnboardingService.processMessage(TEST_PHONE, text);
        console.log(`🤖 Bot:`, typeof response === 'string' ? response : response.message);
        return response;
    }

    // --- FLOW ---

    // Step 0: Name
    await userSays('Me llamo TestUser');

    // Step 0.5: Terms
    await userSays('Acepto');

    // Step 1: Assets
    await userSays('Tengo 200k en Nequi y 50k en efectivo');

    // Step 2: Liabilities
    await userSays('Debo 1M en la tarjeta Visa y 500k a un amigo');

    // Step 2.5: Tutorial Bridge
    await userSays('Dale');

    // Step 3: First Expense
    await userSays('Gasté 15k en almuerzo');

    // Step 4: Account Selection
    await userSays('Nequi');

    // Step 5: Goals
    await userSays('Quiero comprar una moto');

    // Step 6: Risk
    await userSays('Si el mercado cae, vendo todo para no perder más');

    // Step 7: Rating
    await userSays('5 estrellas');

    console.log('\n✅ Simulation Check Complete.');
    process.exit(0);
}

runSimulation();
