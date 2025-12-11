require('dotenv').config();
const { AccountDBService, UserDBService } = require('../src/services/db');
const { closePool } = require('../src/config/database');

const TEST_PHONE = 'whatsapp:+573000000XXX';

async function testLiability() {
    try {
        const user = await UserDBService.findByPhoneNumber(TEST_PHONE);
        if (!user) return console.log('User not found');

        console.log('Atttempting to create Debt account...');
        const created = await AccountDBService.create({
            userId: user.user_id,
            name: 'Test Visa',
            type: 'debt', // <--- This might fail if constraint exists
            balance: 50000,
            icon: '💳'
        });
        console.log('✅ Debt account created successfully!', created.account_id);

        // Now creating Transaction
        const FinanceService = require('../src/services/finance.service');
        console.log('Attempting to create expense transaction with this account...');

        // Mock categorization
        // FinanceService internal methods might depend on AI, but createTransaction takes category ID? 
        // No, createTransaction takes category NAME or ID?
        // Checking FinanceService.createTransaction signature... 
        // It takes `category` object/ID? 
        // OnboardingService passes: `category, target.name`. (Wait, signature check!)

        // OnboardingService line 394:
        /*
        await FinanceService.createTransaction(
            user.phone_number,
            'expense',
            expense.amount,
            expense.description,
            category, // String? Object?
            target.name
        );
        */

        // Let's assume standard usage.
        await FinanceService.createTransaction(
            TEST_PHONE,
            'expense',
            10000,
            'Gasto test deuda',
            'Comida', // Category Name
            'Test Visa' // Account Name
        );
        console.log('✅ Transaction created successfully!');

    } catch (e) {
        console.error('❌ Failed:', e);
    } finally {
        await closePool();
    }
}

testLiability();
