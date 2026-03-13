#!/usr/bin/env node
/**
 * Seed Data Script for Phill Finance
 *
 * Creates realistic demo data for multiple users and resets business data
 * before inserting, so local environments start from a predictable state.
 *
 * Usage:
 *   npm run seed            # destructive reset of all business data
 *   npm run seed:prod-safe  # only regenerate configured demo users
 */

const bcrypt = require('bcrypt');
const { query, transaction, closePool } = require('../src/config/database');

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'Test123!';

const USERS = [
  { name: 'Nicolas Garzon', phone: '+573194914403' },
  { name: 'Felipe', phone: '+573184061996' },
  { name: 'Ovach', phone: '+573214022139' },
  { name: 'Pedra', phone: '3112841260' },
];

const BASE_CATEGORIES = [
  { name: 'Salario', type: 'income', icon: 'briefcase' },
  { name: 'Freelance', type: 'income', icon: 'laptop' },
  { name: 'Ventas', type: 'income', icon: 'store' },
  { name: 'Inversiones', type: 'income', icon: 'trending-up' },
  { name: 'Otros Ingresos', type: 'income', icon: 'plus-circle' },
  { name: 'Vivienda', type: 'expense', icon: 'home' },
  { name: 'Alimentacion', type: 'expense', icon: 'utensils' },
  { name: 'Transporte', type: 'expense', icon: 'car' },
  { name: 'Servicios', type: 'expense', icon: 'zap' },
  { name: 'Salud', type: 'expense', icon: 'heart' },
  { name: 'Educacion', type: 'expense', icon: 'book-open' },
  { name: 'Entretenimiento', type: 'expense', icon: 'film' },
  { name: 'Restaurantes', type: 'expense', icon: 'coffee' },
  { name: 'Compras', type: 'expense', icon: 'shopping-bag' },
  { name: 'Suscripciones', type: 'expense', icon: 'repeat' },
  { name: 'Pago Tarjeta', type: 'expense', icon: 'credit-card' },
  { name: 'Ahorro Programado', type: 'expense', icon: 'piggy-bank' },
];

const TABLES_TO_TRUNCATE = [
  'messages',
  'conversations',
  'ai_insights',
  'auth_tokens',
  'credit_purchase_payments',
  'credit_card_purchases',
  'reminders',
  'budgets',
  'transactions',
  'financial_goals',
  'categories',
  'accounts',
  'subscriptions',
  'users',
];

function toWhatsappPhone(rawPhone) {
  const digits = rawPhone.replace(/[^\d+]/g, '');
  if (digits.startsWith('whatsapp:')) return digits;
  return `whatsapp:${digits.startsWith('+') ? digits : `+57${digits}`}`;
}

function monthsAgoDate(monthsAgo, day = 10) {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(day);
  d.setHours(10, 0, 0, 0);
  return d;
}

async function truncateBusinessData(client) {
  const existing = [];

  for (const tableName of TABLES_TO_TRUNCATE) {
    const check = await client.query('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
    if (check.rows[0].table_name) {
      existing.push(tableName);
    }
  }

  if (!existing.length) return;

  await client.query(`TRUNCATE TABLE ${existing.join(', ')} RESTART IDENTITY CASCADE`);
}

async function resetOnlySeedUsers(client, profiles) {
  const phones = profiles.map((profile) => toWhatsappPhone(profile.phone));
  await client.query(`DELETE FROM users WHERE phone_number = ANY($1::text[])`, [phones]);
}

async function ensureSeedSchema(client) {
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step VARCHAR(50) DEFAULT 'name'`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}'`);

  await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS statement_day INTEGER`);
  await client.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS due_day INTEGER`);
  await client.query(
    `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_statement_day') THEN
        ALTER TABLE accounts ADD CONSTRAINT chk_statement_day CHECK (statement_day IS NULL OR (statement_day BETWEEN 1 AND 28));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_due_day') THEN
        ALTER TABLE accounts ADD CONSTRAINT chk_due_day CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 28));
      END IF;
    END $$;`
  );

  await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2) DEFAULT 0 NOT NULL`);
  await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'COP' NOT NULL`);
  await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS account_name TEXT`);
  await client.query(
    `ALTER TABLE reminders ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(account_id) ON DELETE SET NULL`
  );
  await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(15) DEFAULT 'expense' NOT NULL`);
  await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS completion_status VARCHAR(20) DEFAULT 'pending' NOT NULL`);
  await client.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE`);
  await client.query(
    `ALTER TABLE reminders ADD COLUMN IF NOT EXISTS linked_transaction_id UUID REFERENCES transactions(transaction_id) ON DELETE SET NULL`
  );

  await client.query(
    `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reminder_transaction_type') THEN
        ALTER TABLE reminders ADD CONSTRAINT chk_reminder_transaction_type CHECK (transaction_type IN ('expense', 'income'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reminder_completion_status') THEN
        ALTER TABLE reminders ADD CONSTRAINT chk_reminder_completion_status CHECK (completion_status IN ('pending', 'completed'));
      END IF;
    END $$;`
  );

  await client.query(
    `CREATE TABLE IF NOT EXISTS credit_card_purchases (
      purchase_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
      description VARCHAR(200) NOT NULL,
      total_amount DECIMAL(12, 2) NOT NULL,
      installments INTEGER NOT NULL DEFAULT 1,
      installment_amount DECIMAL(12, 2) NOT NULL,
      paid_installments INTEGER DEFAULT 0,
      remaining_amount DECIMAL(12, 2) NOT NULL,
      total_paid DECIMAL(12, 2) DEFAULT 0,
      purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
      first_payment_date DATE,
      last_payment_date DATE,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      linked_transaction_id UUID REFERENCES transactions(transaction_id) ON DELETE SET NULL
    )`
  );

  await client.query(
    `CREATE TABLE IF NOT EXISTS credit_purchase_payments (
      payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      purchase_id UUID NOT NULL REFERENCES credit_card_purchases(purchase_id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      amount DECIMAL(12, 2) NOT NULL,
      payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes VARCHAR(200),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      linked_transaction_id UUID REFERENCES transactions(transaction_id) ON DELETE SET NULL
    )`
  );

  await client.query(
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('basico', 'premium', 'empresas')),
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'cancelled', 'expired')),
      started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE,
      payment_reference VARCHAR(255),
      amount_paid DECIMAL(12, 2),
      currency VARCHAR(3) DEFAULT 'COP',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, status)
    )`
  );
}

async function createUser(client, profile, passwordHash) {
  const phone = toWhatsappPhone(profile.phone);
  const result = await client.query(
    `INSERT INTO users (
      phone_number, name, timezone, currency, password_hash,
      monthly_income, savings_goal, primary_goal, risk_tolerance, financial_literacy
    )
    VALUES ($1, $2, 'America/Bogota', 'COP', $3, $4, $5, 'save', 'medium', 'intermediate')
    RETURNING user_id, name, phone_number`,
    [phone, profile.name, passwordHash, profile.monthlyIncome, profile.savingsGoal]
  );

  return result.rows[0];
}

async function createCategories(client, userId) {
  const map = {};

  for (const category of BASE_CATEGORIES) {
    const row = await client.query(
      `INSERT INTO categories (user_id, name, type, icon)
       VALUES ($1, $2, $3, $4)
       RETURNING category_id, name`,
      [userId, category.name, category.type, category.icon]
    );
    map[category.name] = row.rows[0].category_id;
  }

  return map;
}

async function createAccounts(client, userId, profile) {
  const defs = [
    {
      key: 'main',
      name: `${profile.bank} Ahorros`,
      type: 'savings',
      balance: profile.startingCash,
      icon: '🏦',
      bankName: profile.bank,
      color: '#3b82f6',
      statementDay: null,
      dueDay: null,
      creditLimit: null,
      interestRate: null,
    },
    {
      key: 'debit',
      name: 'Cuenta Debito',
      type: 'checking',
      balance: Math.round(profile.startingCash * 0.25),
      icon: '💳',
      bankName: profile.bank,
      color: '#22c55e',
      statementDay: null,
      dueDay: null,
      creditLimit: null,
      interestRate: null,
    },
    {
      key: 'cash',
      name: 'Efectivo',
      type: 'cash',
      balance: 500000,
      icon: '💵',
      bankName: null,
      color: '#f59e0b',
      statementDay: null,
      dueDay: null,
      creditLimit: null,
      interestRate: null,
    },
    {
      key: 'credit',
      name: `${profile.creditBrand} Gold`,
      type: 'credit_card',
      balance: profile.creditUsed,
      icon: '💎',
      bankName: profile.bank,
      color: '#8b5cf6',
      statementDay: profile.statementDay,
      dueDay: profile.dueDay,
      creditLimit: profile.creditLimit,
      interestRate: profile.interestRate,
    },
  ];

  const accounts = {};
  for (const def of defs) {
    const row = await client.query(
      `INSERT INTO accounts (
        user_id, name, type, bank_name, icon, color, balance, currency,
        credit_limit, interest_rate, statement_day, due_day, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'COP', $8, $9, $10, $11, true)
      RETURNING account_id, name`,
      [
        userId,
        def.name,
        def.type,
        def.bankName,
        def.icon,
        def.color,
        def.balance,
        def.creditLimit,
        def.interestRate,
        def.statementDay,
        def.dueDay,
      ]
    );
    accounts[def.key] = row.rows[0].account_id;
  }

  return accounts;
}

async function createTransactions(client, userId, categoryIds, accountIds, profile) {
  const tx = [];

  for (let month = 5; month >= 0; month -= 1) {
    tx.push({
      accountId: accountIds.main,
      categoryId: categoryIds.Salario,
      type: 'income',
      amount: profile.monthlyIncome,
      description: `Nomina ${month + 1}`,
      date: monthsAgoDate(month, 1),
    });
    tx.push({
      accountId: accountIds.main,
      categoryId: categoryIds.Vivienda,
      type: 'expense',
      amount: 1200000 + month * 30000,
      description: 'Arriendo',
      date: monthsAgoDate(month, 3),
    });
    tx.push({
      accountId: accountIds.main,
      categoryId: categoryIds.Servicios,
      type: 'expense',
      amount: 260000 + month * 8000,
      description: 'Servicios del hogar',
      date: monthsAgoDate(month, 6),
    });
    tx.push({
      accountId: accountIds.debit,
      categoryId: categoryIds.Alimentacion,
      type: 'expense',
      amount: 420000 + month * 15000,
      description: 'Mercado mensual',
      date: monthsAgoDate(month, 9),
    });
    tx.push({
      accountId: accountIds.debit,
      categoryId: categoryIds.Transporte,
      type: 'expense',
      amount: 260000 + month * 7000,
      description: 'Transporte y gasolina',
      date: monthsAgoDate(month, 12),
    });
    tx.push({
      accountId: accountIds.cash,
      categoryId: categoryIds.Restaurantes,
      type: 'expense',
      amount: 180000 + month * 4000,
      description: 'Comidas fuera',
      date: monthsAgoDate(month, 18),
    });
  }

  tx.push({
    accountId: accountIds.main,
    categoryId: categoryIds.Freelance,
    type: 'income',
    amount: 950000,
    description: 'Proyecto freelance',
    date: monthsAgoDate(1, 22),
  });
  tx.push({
    accountId: accountIds.debit,
    categoryId: categoryIds['Ahorro Programado'],
    type: 'expense',
    amount: 600000,
    description: 'Traslado a ahorro',
    date: monthsAgoDate(0, 15),
  });

  const inserted = [];
  for (const item of tx) {
    const row = await client.query(
      `INSERT INTO transactions (
        user_id, account_id, category_id, type, amount, description,
        transaction_date, currency, status, detected_by_ai
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'COP', 'completed', false)
      RETURNING transaction_id, amount, type`,
      [userId, item.accountId, item.categoryId, item.type, item.amount, item.description, item.date]
    );
    inserted.push(row.rows[0]);
  }

  return inserted;
}

async function createBudgets(client, userId, categoryIds) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  const defs = [
    { category: 'Alimentacion', limit: 1200000 },
    { category: 'Transporte', limit: 650000 },
    { category: 'Restaurantes', limit: 550000 },
    { category: 'Entretenimiento', limit: 450000 },
  ];

  for (const budget of defs) {
    await client.query(
      `INSERT INTO budgets (
        user_id, category_id, limit_amount, period, start_date,
        current_spent, alert_threshold, alert_sent, is_active
      )
      VALUES ($1, $2, $3, 'monthly', $4, 0, 80, false, true)`,
      [userId, categoryIds[budget.category], budget.limit, start]
    );
  }
}

async function createGoals(client, userId, profile) {
  const goals = [
    {
      name: 'Fondo de Emergencia',
      target: profile.savingsGoal,
      current: Math.round(profile.savingsGoal * 0.35),
      date: '2026-12-15',
      icon: 'shield',
    },
    {
      name: 'Viaje Internacional',
      target: 8000000,
      current: 2100000,
      date: '2026-11-30',
      icon: 'plane',
    },
    {
      name: 'Curso Profesional',
      target: 2200000,
      current: 700000,
      date: '2026-08-20',
      icon: 'graduation-cap',
    },
  ];

  for (const goal of goals) {
    await client.query(
      `INSERT INTO financial_goals (
        user_id, name, target_amount, current_amount, target_date, icon, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
      [userId, goal.name, goal.target, goal.current, goal.date, goal.icon]
    );
  }
}

async function createCreditData(client, userId, categoryIds, accountIds) {
  const purchaseDate = monthsAgoDate(2, 11);
  const purchaseTx = await client.query(
    `INSERT INTO transactions (
      user_id, account_id, category_id, type, amount, description,
      transaction_date, currency, status, detected_by_ai
    )
    VALUES ($1, $2, $3, 'expense', $4, $5, $6, 'COP', 'completed', false)
    RETURNING transaction_id`,
    [userId, accountIds.credit, categoryIds.Compras, 2400000, 'Laptop a 12 cuotas', purchaseDate]
  );

  const purchase = await client.query(
    `INSERT INTO credit_card_purchases (
      user_id, account_id, description, total_amount, installments, installment_amount,
      paid_installments, remaining_amount, total_paid, purchase_date, status, linked_transaction_id
    )
    VALUES ($1, $2, $3, 2400000, 12, 200000, 3, 1800000, 600000, $4, 'active', $5)
    RETURNING purchase_id`,
    [userId, accountIds.credit, 'Laptop a 12 cuotas', purchaseDate, purchaseTx.rows[0].transaction_id]
  );

  const paymentDates = [monthsAgoDate(2, 28), monthsAgoDate(1, 28), monthsAgoDate(0, 28)];

  for (const paymentDate of paymentDates) {
    const paymentTx = await client.query(
      `INSERT INTO transactions (
        user_id, account_id, category_id, type, amount, description,
        transaction_date, currency, status, detected_by_ai
      )
      VALUES ($1, $2, $3, 'expense', 200000, 'Pago cuota tarjeta', $4, 'COP', 'completed', false)
      RETURNING transaction_id`,
      [userId, accountIds.main, categoryIds['Pago Tarjeta'], paymentDate]
    );

    await client.query(
      `INSERT INTO credit_purchase_payments (
        purchase_id, user_id, amount, payment_date, notes, linked_transaction_id
      )
      VALUES ($1, $2, 200000, $3, 'Pago mensual', $4)`,
      [purchase.rows[0].purchase_id, userId, paymentDate, paymentTx.rows[0].transaction_id]
    );
  }
}

async function createReminders(client, userId, accountIds) {
  const upcoming = new Date();
  upcoming.setDate(upcoming.getDate() + 3);
  upcoming.setHours(8, 0, 0, 0);

  const overdue = new Date();
  overdue.setDate(overdue.getDate() - 2);
  overdue.setHours(9, 0, 0, 0);

  const recurring = new Date();
  recurring.setDate(28);
  recurring.setHours(8, 30, 0, 0);

  await client.query(
    `INSERT INTO reminders (
      user_id, message, scheduled_at, is_recurring, recurrence_pattern, status,
      amount, currency, account_name, account_id, transaction_type, completion_status
    )
    VALUES
      ($1, 'Pagar cuota de tarjeta de credito', $2, true, 'monthly', 'pending', 200000, 'COP', 'Cuenta Debito', $3, 'expense', 'pending'),
      ($1, 'Separar ahorro mensual', $4, true, 'monthly', 'pending', 500000, 'COP', 'Cuenta Debito', $3, 'expense', 'pending'),
      ($1, 'Recordatorio vencido: pagar servicios', $5, false, NULL, 'pending', 320000, 'COP', 'Cuenta Debito', $3, 'expense', 'pending'),
      ($1, 'Ingreso de freelance registrado', $6, false, NULL, 'sent', 950000, 'COP', 'Cuenta Debito', $3, 'income', 'completed')`,
    [userId, recurring, accountIds.debit, upcoming, overdue, monthsAgoDate(0, 4)]
  );
}

async function createSubscription(client, userId) {
  const starts = monthsAgoDate(1, 1);
  const expires = new Date(starts);
  expires.setMonth(expires.getMonth() + 1);

  await client.query(
    `INSERT INTO subscriptions (
      user_id, plan_type, status, started_at, expires_at, payment_reference, amount_paid, currency
    )
    VALUES ($1, 'premium', 'active', $2, $3, $4, 39000, 'COP')`,
    [userId, starts, expires, `seed-${userId.slice(0, 8)}`]
  );
}

async function seed({ safeMode = false } = {}) {
  console.log(
    safeMode
      ? 'Seeding base de datos (modo prod-safe: solo usuarios demo)...'
      : 'Seeding base de datos (reset global + datos demo)...'
  );

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const profiles = [
      {
        ...USERS[0],
        monthlyIncome: 8600000,
        savingsGoal: 20000000,
        bank: 'Bancolombia',
        creditBrand: 'Visa',
        creditLimit: 12000000,
        creditUsed: 2300000,
        statementDay: 17,
        dueDay: 25,
        interestRate: 2.1,
        startingCash: 7400000,
      },
      {
        ...USERS[1],
        monthlyIncome: 6200000,
        savingsGoal: 12000000,
        bank: 'Davivienda',
        creditBrand: 'Mastercard',
        creditLimit: 8500000,
        creditUsed: 1900000,
        statementDay: 12,
        dueDay: 20,
        interestRate: 2.4,
        startingCash: 5100000,
      },
      {
        ...USERS[2],
        monthlyIncome: 5400000,
        savingsGoal: 10000000,
        bank: 'BBVA',
        creditBrand: 'American Express',
        creditLimit: 9000000,
        creditUsed: 2800000,
        statementDay: 8,
        dueDay: 18,
        interestRate: 2.3,
        startingCash: 4600000,
      },
      {
        ...USERS[3],
        monthlyIncome: 7100000,
        savingsGoal: 15000000,
        bank: 'Nu',
        creditBrand: 'Visa',
        creditLimit: 10000000,
        creditUsed: 1250000,
        statementDay: 14,
        dueDay: 24,
        interestRate: 2.2,
        startingCash: 6200000,
      },
    ];

    const createdUsers = [];

    await transaction(async (client) => {
      await ensureSeedSchema(client);
      if (safeMode) {
        await resetOnlySeedUsers(client, profiles);
      } else {
        await truncateBusinessData(client);
      }

      await client.query(`SET session_replication_role = 'replica'`);
      try {
        for (const profile of profiles) {
          const user = await createUser(client, profile, passwordHash);
          const categoryIds = await createCategories(client, user.user_id);
          const accountIds = await createAccounts(client, user.user_id, profile);

          await createTransactions(client, user.user_id, categoryIds, accountIds, profile);
          await createBudgets(client, user.user_id, categoryIds);
          await createGoals(client, user.user_id, profile);
          await createCreditData(client, user.user_id, categoryIds, accountIds);
          await createReminders(client, user.user_id, accountIds);
          await createSubscription(client, user.user_id);

          createdUsers.push({
            userId: user.user_id,
            name: user.name,
            phone: user.phone_number.replace('whatsapp:', ''),
          });
        }
      } finally {
        await client.query(`SET session_replication_role = 'origin'`);
      }
    });

    const seedUserIds = createdUsers.map((user) => user.userId);
    const counts = await query(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE user_id = ANY($1::uuid[])) AS users,
        (SELECT COUNT(*) FROM accounts WHERE user_id = ANY($1::uuid[])) AS accounts,
        (SELECT COUNT(*) FROM categories WHERE user_id = ANY($1::uuid[])) AS categories,
        (SELECT COUNT(*) FROM transactions WHERE user_id = ANY($1::uuid[])) AS transactions,
        (SELECT COUNT(*) FROM reminders WHERE user_id = ANY($1::uuid[])) AS reminders,
        (SELECT COUNT(*) FROM credit_card_purchases WHERE user_id = ANY($1::uuid[])) AS purchases,
        (SELECT COUNT(*) FROM credit_purchase_payments WHERE user_id = ANY($1::uuid[])) AS payments,
        (SELECT COUNT(*) FROM financial_goals WHERE user_id = ANY($1::uuid[])) AS goals,
        (SELECT COUNT(*) FROM budgets WHERE user_id = ANY($1::uuid[])) AS budgets,
        (SELECT COUNT(*) FROM subscriptions WHERE user_id = ANY($1::uuid[])) AS subscriptions`,
      [seedUserIds]
    );

    const globalCounts = await query(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM accounts) AS accounts,
        (SELECT COUNT(*) FROM categories) AS categories,
        (SELECT COUNT(*) FROM transactions) AS transactions,
        (SELECT COUNT(*) FROM reminders) AS reminders,
        (SELECT COUNT(*) FROM credit_card_purchases) AS purchases,
        (SELECT COUNT(*) FROM credit_purchase_payments) AS payments,
        (SELECT COUNT(*) FROM financial_goals) AS goals,
        (SELECT COUNT(*) FROM budgets) AS budgets,
        (SELECT COUNT(*) FROM subscriptions) AS subscriptions`
    );

    const s = counts.rows[0];
    const g = globalCounts.rows[0];

    console.log('\nSeed completado.');
    console.log('Usuarios creados:');
    for (const user of createdUsers) {
      console.log(`- ${user.name} (${user.phone})`);
    }
    console.log(`\nPassword para todos: ${DEFAULT_PASSWORD}`);
    console.log('\nTotales (usuarios seed):');
    console.log(`- users: ${s.users}`);
    console.log(`- accounts: ${s.accounts}`);
    console.log(`- categories: ${s.categories}`);
    console.log(`- transactions: ${s.transactions}`);
    console.log(`- reminders: ${s.reminders}`);
    console.log(`- credit_card_purchases: ${s.purchases}`);
    console.log(`- credit_purchase_payments: ${s.payments}`);
    console.log(`- financial_goals: ${s.goals}`);
    console.log(`- budgets: ${s.budgets}`);
    console.log(`- subscriptions: ${s.subscriptions}`);

    if (safeMode) {
      console.log('\nTotales globales:');
      console.log(`- users: ${g.users}`);
      console.log(`- accounts: ${g.accounts}`);
      console.log(`- categories: ${g.categories}`);
      console.log(`- transactions: ${g.transactions}`);
      console.log(`- reminders: ${g.reminders}`);
      console.log(`- credit_card_purchases: ${g.purchases}`);
      console.log(`- credit_purchase_payments: ${g.payments}`);
      console.log(`- financial_goals: ${g.goals}`);
      console.log(`- budgets: ${g.budgets}`);
      console.log(`- subscriptions: ${g.subscriptions}`);
    }
  } catch (error) {
    console.error('\nError ejecutando seed:', error.message);
    throw error;
  } finally {
    await closePool();
  }
}

const safeMode = process.argv.includes('--prod-safe');

seed({ safeMode })
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
