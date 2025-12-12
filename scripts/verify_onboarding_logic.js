
const path = require('path');

// Mock helpers
const mockUser = {
    user_id: 1,
    phone_number: '123456789',
    onboarding_data: {
        pending_expense: { amount: 10000, description: 'test expense' },
        step: 'test_step'
    }
};

// --- MOCKING DEPENDENCIES ---
// We need to load these first and monkey-patch them before OnboardingService uses them.
// Assuming they export singleton instances or objects.

const UserDBService = require('../src/services/db/user.db.service');
const AccountDBService = require('../src/services/db/account.db.service');
const FinanceService = require('../src/services/finance.service');
const ReminderDBService = require('../src/services/db/reminder.db.service');
const AIService = require('../src/services/ai.service');

// Mock UserDBService
UserDBService.updateUser = async (phone, data) => {
    console.log(`[MockDB] updateUser ${phone}:`, JSON.stringify(data));
    // Update local mock
    Object.assign(mockUser.onboarding_data, data.onboarding_data || {});
    return mockUser;
};
UserDBService.updateProfile = async () => { };

// Mock AccountDBService
let mockAccounts = [
    { account_id: 1, name: 'Nequi', type: 'bank', balance: 50000, is_default: false },
    { account_id: 2, name: 'Bancolombia', type: 'bank', balance: 2000000, is_default: false },
    { account_id: 3, name: 'Efectivo', type: 'cash', balance: 20000, is_default: true }
];

AccountDBService.findByUser = async (userId) => {
    return [...mockAccounts]; // Return copy
};

AccountDBService.create = async (data) => {
    console.log('[MockDB] AccountDBService.create:', data);
    const newAccount = { ...data, account_id: mockAccounts.length + 1, is_default: data.isDefault };
    mockAccounts.push(newAccount);
    return newAccount;
};

// Mock FinanceService
FinanceService.categorizeTransaction = async () => 'Comida';
FinanceService.createTransaction = async (phone, type, amount, desc, cat, accName) => {
    console.log(`[MockDB] Transaction Created: ${amount} from ${accName} (${cat})`);
};

// Mock AIService
// We interact with it by intercepting usage inside OnboardingService? 
// Actually OnboardingService requires it dynamically in some methods. 
// But since we require it here, and node caches modules, if we patch the exports of the *file*, it should work?
// Let's try patching the methods.
AIService.extractInitialBalances = async (msg) => {
    // Basic mock logic
    return { accounts: [] }; // Default empty to test our manual Zero logic
};


// --- LOAD SERVICE UNDER TEST ---
const OnboardingService = require('../src/services/onboarding.service');

// --- TESTS ---

async function runTests() {
    console.log('--- STARTING VERIFICATION ---');

    console.log('\n🔵 TEST CASE F01: Zero Assets ("No tengo nada")');
    // Scenario: User says "No tengo nada" in initial_balances step
    mockUser.onboarding_data.step = 'initial_balances';
    const msgAssets = "No tengo nada, estoy en ceros";
    const resAssets = await OnboardingService.handleInitialAssetsStep(mockUser, msgAssets);
    console.log('Result:', JSON.stringify(resAssets, null, 2));
    if (resAssets.message && resAssets.message.includes('Efectivo: $0') && resAssets.message.includes('Total: $0')) {
        console.log('✅ PASS: Handled zero assets correctly.');
    } else {
        console.log('❌ FAIL: Did not handle zero assets as expected.');
    }

    console.log('\n🔵 TEST CASE F04: Numeric Account Selection ("2")');
    // Scenario: User selects account "2" (Bancolombia)
    mockUser.onboarding_data.step = 'expense_account';
    mockUser.onboarding_data.pending_expense = { amount: 50000, description: 'Cena' };
    const msgNum = "2";
    // Expect "Descontado de Bancolombia"
    const resNum = await OnboardingService.handleExpenseAccountStep(mockUser, msgNum);
    console.log('Result:', resNum);
    if (resNum.includes('Descontado de Bancolombia')) {
        console.log('✅ PASS: Selected Account 2 (Bancolombia) correctly.');
    } else {
        console.log('❌ FAIL: Did not select Account 2.');
    }

    console.log('\n🔵 TEST CASE F05: Smart Default ("La del perrito")');
    // Scenario: User sends garbage. Should pick Default (Efectivo) and Warn.
    mockUser.onboarding_data.step = 'expense_account';
    const msgGarbage = "La del perrito";
    // Expect "No encontré... puse en Efectivo"
    const resGarbage = await OnboardingService.handleExpenseAccountStep(mockUser, msgGarbage);
    console.log('Result:', resGarbage);
    if (resGarbage.includes('No encontré "La del perrito"') && resGarbage.includes('Efectivo')) {
        console.log('✅ PASS: Used default account and warned user.');
    } else {
        console.log('❌ FAIL: Did not use fallback or warn.');
    }

    console.log('\n🔵 TEST CASE T01/Guard: Confirm Expense with No Accounts');
    // Scenario: DB returns empty accounts. Should create default and proceed.
    mockAccounts = []; // Clear DB
    mockUser.onboarding_data.step = 'confirm_first_expense';
    mockUser.onboarding_data.pending_expense = { amount: 1000, description: 'Pan' };

    // logic calls accounts.slice(0,3).map...
    try {
        const resGuard = await OnboardingService.handleConfirmFirstExpenseStep(mockUser, "accepted"); // Msg doesn't matter much here unless 'retry'
        console.log('Result Buttons:', JSON.stringify(resGuard.buttons));
        if (resGuard.buttons && resGuard.buttons.some(b => b.title === 'Efectivo')) {
            console.log('✅ PASS: Created emergency default account and showed button.');
        } else {
            console.log('❌ FAIL: Did not create emergency account.');
        }
    } catch (e) {
        console.log('❌ FAIL: Crashed with error:', e.message);
    }

    console.log('\n--- VERIFICATION COMPLETE ---');
}

runTests().catch(console.error);
