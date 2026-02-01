#!/usr/bin/env node
/**
 * Seed Data Script for Phill Finance
 * 
 * Creates test data for development and testing purposes.
 * Disables triggers during seeding to avoid balance issues.
 * 
 * Usage: npm run seed
 */

const { query, closePool } = require('../src/config/database');
const bcrypt = require('bcrypt');

// Configuration
const TEST_USER = {
    phone_number: 'whatsapp:+573001234567',
    name: 'Usuario Demo',
    timezone: 'America/Bogota',
    password: 'Test123', // Default password for seed user
};

// Categories (Spanish for Colombia)
const CATEGORIES = [
    // Income categories
    { name: 'Salario', type: 'income', icon: '💼' },
    { name: 'Freelance', type: 'income', icon: '💻' },
    { name: 'Inversiones', type: 'income', icon: '📈' },
    { name: 'Regalos', type: 'income', icon: '🎁' },
    { name: 'Otros Ingresos', type: 'income', icon: '💰' },

    // Expense categories
    { name: 'Vivienda', type: 'expense', icon: '🏠' },
    { name: 'Alimentación', type: 'expense', icon: '🍽️' },
    { name: 'Transporte', type: 'expense', icon: '🚗' },
    { name: 'Servicios', type: 'expense', icon: '💡' },
    { name: 'Salud', type: 'expense', icon: '⚕️' },
    { name: 'Entretenimiento', type: 'expense', icon: '🎬' },
    { name: 'Educación', type: 'expense', icon: '📚' },
    { name: 'Ropa', type: 'expense', icon: '👕' },
    { name: 'Tecnología', type: 'expense', icon: '📱' },
    { name: 'Restaurantes', type: 'expense', icon: '🍕' },
    { name: 'Suscripciones', type: 'expense', icon: '📺' },
    { name: 'Mascotas', type: 'expense', icon: '🐕' },
    { name: 'Otros Gastos', type: 'expense', icon: '💸' },
];

// Accounts with high balances to support expenses
const ACCOUNTS = [
    { name: 'Bancolombia Ahorros', type: 'savings', bank_name: 'Bancolombia', icon: '🏦', initial_balance: 15000000 },
    { name: 'Nequi', type: 'savings', bank_name: 'Bancolombia', icon: '💳', initial_balance: 2500000 },
    { name: 'Daviplata', type: 'savings', bank_name: 'Davivienda', icon: '💳', initial_balance: 1200000 },
    { name: 'Efectivo', type: 'cash', bank_name: null, icon: '💵', initial_balance: 800000 },
];

// Financial Goals
const GOALS = [
    { name: 'Viaje a Europa', target_amount: 15000000, current_amount: 5200000, target_date: '2026-12-01', icon: '✈️' },
    { name: 'Fondo de Emergencia', target_amount: 10000000, current_amount: 7800000, target_date: '2026-06-01', icon: '🛡️' },
    { name: 'Nuevo Laptop', target_amount: 5000000, current_amount: 2100000, target_date: '2026-04-15', icon: '💻' },
    { name: 'Curso de Inglés', target_amount: 2500000, current_amount: 800000, target_date: '2026-03-01', icon: '📖' },
];

// Static transactions for predictable seeding
function generateTransactions(userId, accounts, categories) {
    const transactions = [];
    const now = new Date();

    // Get main account (all transactions go here for simplicity)
    const mainAccount = accounts.find(a => a.name.includes('Bancolombia'));
    const nequiAccount = accounts.find(a => a.name === 'Nequi');

    // Find categories
    const findCat = (name) => categories.find(c => c.name === name);

    // === INCOMES (First to build balance) ===
    transactions.push({
        user_id: userId,
        account_id: mainAccount.account_id,
        category_id: findCat('Salario').category_id,
        type: 'income',
        amount: 4500000,
        description: 'Nómina Quincenal',
        transaction_date: new Date(now.getFullYear(), now.getMonth(), 1),
    });

    transactions.push({
        user_id: userId,
        account_id: mainAccount.account_id,
        category_id: findCat('Salario').category_id,
        type: 'income',
        amount: 4500000,
        description: 'Nómina Quincenal',
        transaction_date: new Date(now.getFullYear(), now.getMonth(), 15),
    });

    transactions.push({
        user_id: userId,
        account_id: nequiAccount.account_id,
        category_id: findCat('Freelance').category_id,
        type: 'income',
        amount: 850000,
        description: 'Proyecto Diseño Web',
        transaction_date: new Date(now.getFullYear(), now.getMonth(), 18),
    });

    // === FIXED EXPENSES ===
    const fixedExpenses = [
        { cat: 'Vivienda', desc: 'Arriendo Apartamento', amount: 1800000, day: 5 },
        { cat: 'Vivienda', desc: 'Administración', amount: 250000, day: 5 },
        { cat: 'Servicios', desc: 'Internet + TV', amount: 95000, day: 10 },
        { cat: 'Servicios', desc: 'Celular', amount: 65000, day: 12 },
        { cat: 'Servicios', desc: 'Electricidad', amount: 120000, day: 15 },
        { cat: 'Servicios', desc: 'Gas', amount: 45000, day: 16 },
        { cat: 'Suscripciones', desc: 'Netflix', amount: 45000, day: 8 },
        { cat: 'Suscripciones', desc: 'Spotify', amount: 17000, day: 8 },
        { cat: 'Suscripciones', desc: 'Amazon Prime', amount: 25000, day: 20 },
    ];

    fixedExpenses.forEach(exp => {
        const cat = findCat(exp.cat);
        if (cat) {
            transactions.push({
                user_id: userId,
                account_id: mainAccount.account_id,
                category_id: cat.category_id,
                type: 'expense',
                amount: exp.amount,
                description: exp.desc,
                transaction_date: new Date(now.getFullYear(), now.getMonth(), exp.day),
            });
        }
    });

    // === VARIABLE EXPENSES (Limited set) ===
    const variableExpenses = [
        { cat: 'Alimentación', desc: 'Mercado Éxito', amount: 280000, daysAgo: 2 },
        { cat: 'Alimentación', desc: 'Mercado D1', amount: 95000, daysAgo: 7 },
        { cat: 'Alimentación', desc: 'Carulla Express', amount: 65000, daysAgo: 12 },
        { cat: 'Transporte', desc: 'Uber', amount: 28000, daysAgo: 1 },
        { cat: 'Transporte', desc: 'DiDi', amount: 35000, daysAgo: 3 },
        { cat: 'Transporte', desc: 'Gasolina', amount: 80000, daysAgo: 8 },
        { cat: 'Restaurantes', desc: 'Almuerzo trabajo', amount: 25000, daysAgo: 0 },
        { cat: 'Restaurantes', desc: 'Cena restaurante', amount: 120000, daysAgo: 4 },
        { cat: 'Restaurantes', desc: 'Rappi', amount: 45000, daysAgo: 6 },
        { cat: 'Entretenimiento', desc: 'Cine', amount: 65000, daysAgo: 5 },
        { cat: 'Entretenimiento', desc: 'Bar con amigos', amount: 150000, daysAgo: 9 },
        { cat: 'Salud', desc: 'Farmacia', amount: 45000, daysAgo: 10 },
        { cat: 'Salud', desc: 'Gym mensual', amount: 120000, daysAgo: 1 },
        { cat: 'Tecnología', desc: 'Audífonos Bluetooth', amount: 180000, daysAgo: 15 },
        { cat: 'Ropa', desc: 'Camisetas', amount: 150000, daysAgo: 20 },
    ];

    variableExpenses.forEach(exp => {
        const cat = findCat(exp.cat);
        if (cat) {
            const date = new Date(now);
            date.setDate(date.getDate() - exp.daysAgo);
            transactions.push({
                user_id: userId,
                account_id: mainAccount.account_id,
                category_id: cat.category_id,
                type: 'expense',
                amount: exp.amount,
                description: exp.desc,
                transaction_date: date,
            });
        }
    });

    return transactions;
}

async function seed() {
    console.log('🌱 Iniciando seed de datos de prueba...\n');

    try {
        // Disable triggers for seeding
        console.log('⚙️  Deshabilitando triggers temporalmente...');
        await query(`SET session_replication_role = 'replica'`);

        // 1. Create or get test user
        console.log('\n👤 Creando usuario de prueba...');
        let user = await query(
            `SELECT * FROM users WHERE phone_number = $1`,
            [TEST_USER.phone_number]
        );

        if (user.rows.length === 0) {
            // Hash password for new user
            const passwordHash = await bcrypt.hash(TEST_USER.password, 10);
            user = await query(
                `INSERT INTO users (phone_number, name, timezone, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
                [TEST_USER.phone_number, TEST_USER.name, TEST_USER.timezone, passwordHash]
            );
            console.log(`   ✓ Usuario creado: ${TEST_USER.name} (${TEST_USER.phone_number})`);
            console.log(`   ✓ Contraseña configurada: ${TEST_USER.password}`);
        } else {
            // Update password for existing user
            const passwordHash = await bcrypt.hash(TEST_USER.password, 10);
            await query(
                `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE phone_number = $2`,
                [passwordHash, TEST_USER.phone_number]
            );
            console.log(`   ✓ Usuario existente: ${user.rows[0].name} (${TEST_USER.phone_number})`);
            console.log(`   ✓ Contraseña actualizada: ${TEST_USER.password}`);
            user = await query(
                `SELECT * FROM users WHERE phone_number = $1`,
                [TEST_USER.phone_number]
            );
        }

        const userId = user.rows[0].user_id;

        // 2. Create categories
        console.log('\n📂 Creando categorías...');
        const createdCategories = [];

        for (const cat of CATEGORIES) {
            const existing = await query(
                `SELECT * FROM categories WHERE user_id = $1 AND name = $2`,
                [userId, cat.name]
            );

            if (existing.rows.length === 0) {
                const result = await query(
                    `INSERT INTO categories (user_id, name, type, icon, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING *`,
                    [userId, cat.name, cat.type, cat.icon]
                );
                createdCategories.push({ ...result.rows[0], type: cat.type });
            } else {
                createdCategories.push({ ...existing.rows[0], type: cat.type });
            }
        }
        console.log(`   ✓ ${createdCategories.length} categorías listas`);

        // 3. Create accounts (delete existing first to reset)
        console.log('\n🏦 Creando cuentas...');
        await query(`DELETE FROM accounts WHERE user_id = $1`, [userId]);

        const createdAccounts = [];
        for (const acc of ACCOUNTS) {
            const result = await query(
                `INSERT INTO accounts (user_id, name, type, bank_name, icon, balance, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
           RETURNING *`,
                [userId, acc.name, acc.type, acc.bank_name, acc.icon, acc.initial_balance]
            );
            createdAccounts.push(result.rows[0]);
        }
        console.log(`   ✓ ${createdAccounts.length} cuentas listas`);

        // 4. Create financial goals
        console.log('\n🎯 Creando metas financieras...');
        await query(`DELETE FROM financial_goals WHERE user_id = $1`, [userId]);

        for (const goal of GOALS) {
            await query(
                `INSERT INTO financial_goals (user_id, name, target_amount, current_amount, target_date, icon, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())`,
                [userId, goal.name, goal.target_amount, goal.current_amount, goal.target_date, goal.icon]
            );
        }
        console.log(`   ✓ ${GOALS.length} metas financieras listas`);

        // 5. Clear and insert transactions
        console.log('\n💳 Generando transacciones...');
        await query(`DELETE FROM transactions WHERE user_id = $1`, [userId]);

        const transactions = generateTransactions(userId, createdAccounts, createdCategories);

        for (const tx of transactions) {
            await query(
                `INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, transaction_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
                [tx.user_id, tx.account_id, tx.category_id, tx.type, tx.amount, tx.description, tx.transaction_date]
            );
        }
        console.log(`   ✓ ${transactions.length} transacciones generadas`);

        // 6. Re-enable triggers
        console.log('\n⚙️  Rehabilitando triggers...');
        await query(`SET session_replication_role = 'origin'`);

        // 7. Calculate and update account balances
        console.log('💰 Recalculando saldos de cuentas...');

        for (const account of createdAccounts) {
            const balanceResult = await query(
                `SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses
         FROM transactions 
         WHERE user_id = $1 AND account_id = $2`,
                [userId, account.account_id]
            );

            const initialBalance = ACCOUNTS.find(a => a.name === account.name)?.initial_balance || 0;
            const income = parseFloat(balanceResult.rows[0].total_income);
            const expenses = parseFloat(balanceResult.rows[0].total_expenses);
            const newBalance = initialBalance + income - expenses;

            await query(
                `UPDATE accounts SET balance = $1, updated_at = NOW() WHERE account_id = $2`,
                [newBalance, account.account_id]
            );
        }
        console.log('   ✓ Saldos actualizados');

        // Summary
        const totalBalance = await query(
            `SELECT SUM(balance) as total FROM accounts WHERE user_id = $1`,
            [userId]
        );

        console.log('\n' + '='.repeat(50));
        console.log('✅ SEED COMPLETADO EXITOSAMENTE');
        console.log('='.repeat(50));
        console.log(`
📊 Resumen:
   • Usuario: ${TEST_USER.name}
   • Cuentas: ${createdAccounts.length}
   • Categorías: ${createdCategories.length}
   • Transacciones: ${transactions.length}
   • Balance Total: $${parseInt(totalBalance.rows[0].total).toLocaleString('es-CO')}

📱 Datos de acceso para login web:
   Teléfono: +57 3001234567
   Contraseña: ${TEST_USER.password}

💡 Opciones de login:
   1. Login tradicional: usa el teléfono y contraseña anterior
   2. Registro OTP: solicita nuevo OTP via WhatsApp (el código aparecerá en logs en development)
`);

    } catch (error) {
        console.error('\n❌ Error durante el seed:', error);
        // Re-enable triggers even on error
        try {
            await query(`SET session_replication_role = 'origin'`);
        } catch (e) {
            // Ignore
        }
        throw error;
    } finally {
        await closePool();
    }
}

// Run seed
seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
