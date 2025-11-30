#!/usr/bin/env node
/**
 * Script para sembrar datos de ejemplo en la base de datos
 * Útil para pruebas y desarrollo
 * 
 * Uso: node scripts/db-seed.js
 */

require('dotenv').config();
const { Pool } = require('pg');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function seedDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'phill_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    log('\n🌱 Sembrando datos de ejemplo en la base de datos...', 'bright');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    const client = await pool.connect();

    // Usuario de ejemplo
    const phoneNumber = 'whatsapp:+1234567890';
    
    log('👤 Creando usuario de ejemplo...', 'blue');
    const userResult = await client.query(
      `INSERT INTO users (
        phone_number, 
        name, 
        monthly_income, 
        savings_goal,
        financial_literacy,
        primary_goal
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (phone_number) DO UPDATE 
      SET name = EXCLUDED.name
      RETURNING user_id`,
      [phoneNumber, 'Juan Ejemplo', 3000000, 500000, 'beginner', 'save']
    );

    const userId = userResult.rows[0].user_id;
    log(`✅ Usuario creado: ${phoneNumber}\n`, 'green');

    // Categorías
    log('🏷️  Creando categorías...', 'blue');
    const categories = [
      { name: 'Alimentación', type: 'expense', icon: '🍔', color: '#ef4444' },
      { name: 'Transporte', type: 'expense', icon: '🚗', color: '#f59e0b' },
      { name: 'Entretenimiento', type: 'expense', icon: '🎬', color: '#ec4899' },
      { name: 'Salario', type: 'income', icon: '💰', color: '#10b981' },
      { name: 'Freelance', type: 'income', icon: '💼', color: '#3b82f6' },
    ];

    const categoryIds = {};
    for (const cat of categories) {
      const result = await client.query(
        `INSERT INTO categories (user_id, name, type, icon, color)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, name, type) DO UPDATE 
         SET icon = EXCLUDED.icon, color = EXCLUDED.color
         RETURNING category_id, name`,
        [userId, cat.name, cat.type, cat.icon, cat.color]
      );
      categoryIds[cat.name] = result.rows[0].category_id;
    }
    log(`✅ ${categories.length} categorías creadas\n`, 'green');

    // Cuentas
    log('💳 Creando cuentas...', 'blue');
    const accounts = [
      { name: 'Bancolombia Ahorros', type: 'savings', bank: 'Bancolombia', balance: 1500000 },
      { name: 'Efectivo', type: 'cash', balance: 200000 },
    ];

    const accountIds = {};
    for (const acc of accounts) {
      const result = await client.query(
        `INSERT INTO accounts (user_id, name, type, bank_name, balance, is_default)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING account_id, name`,
        [userId, acc.name, acc.type, acc.bank || null, acc.balance, acc.type === 'savings']
      );
      accountIds[acc.name] = result.rows[0].account_id;
    }
    log(`✅ ${accounts.length} cuentas creadas\n`, 'green');

    // Transacciones
    log('💰 Creando transacciones de ejemplo...', 'blue');
    const transactions = [
      { type: 'income', amount: 3000000, desc: 'Salario mensual', category: 'Salario', daysAgo: 30 },
      { type: 'expense', amount: 50000, desc: 'Almuerzo con amigos', category: 'Alimentación', daysAgo: 5 },
      { type: 'expense', amount: 30000, desc: 'Uber al trabajo', category: 'Transporte', daysAgo: 3 },
      { type: 'expense', amount: 80000, desc: 'Mercado del mes', category: 'Alimentación', daysAgo: 2 },
      { type: 'income', amount: 500000, desc: 'Proyecto freelance', category: 'Freelance', daysAgo: 1 },
      { type: 'expense', amount: 25000, desc: 'Netflix', category: 'Entretenimiento', daysAgo: 1 },
    ];

    for (const trans of transactions) {
      const date = new Date();
      date.setDate(date.getDate() - trans.daysAgo);
      
      await client.query(
        `INSERT INTO transactions (
          user_id, 
          account_id, 
          category_id, 
          type, 
          amount, 
          description, 
          transaction_date,
          detected_by_ai
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          accountIds['Bancolombia Ahorros'],
          categoryIds[trans.category],
          trans.type,
          trans.amount,
          trans.desc,
          date,
          true
        ]
      );
    }
    log(`✅ ${transactions.length} transacciones creadas\n`, 'green');

    // Meta financiera
    log('🎯 Creando meta financiera...', 'blue');
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 6);
    
    await client.query(
      `INSERT INTO financial_goals (
        user_id, 
        name, 
        description, 
        target_amount, 
        current_amount, 
        target_date, 
        category,
        priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        'Fondo de Emergencia',
        'Ahorrar para emergencias equivalente a 3 meses de gastos',
        3000000,
        500000,
        targetDate,
        'emergency',
        10
      ]
    );
    log('✅ Meta financiera creada\n', 'green');

    // Conversación de ejemplo
    log('💬 Creando conversación de ejemplo...', 'blue');
    const convResult = await client.query(
      `INSERT INTO conversations (user_id, started_at, message_count)
       VALUES ($1, $2, $3)
       RETURNING conversation_id`,
      [userId, new Date(), 4]
    );

    const conversationId = convResult.rows[0].conversation_id;

    const messages = [
      { role: 'user', content: '¿Qué es un ETF?' },
      { role: 'assistant', content: '¡Hola! Un ETF es como una canasta llena de acciones o bonos...' },
      { role: 'user', content: '¿Cómo funciona el interés compuesto?' },
      { role: 'assistant', content: 'Imagina una bola de nieve rodando cuesta abajo...' },
    ];

    for (const msg of messages) {
      await client.query(
        `INSERT INTO messages (conversation_id, user_id, role, content)
         VALUES ($1, $2, $3, $4)`,
        [conversationId, userId, msg.role, msg.content]
      );
    }
    log('✅ Conversación con 4 mensajes creada\n', 'green');

    client.release();

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('🎉 ¡Datos de ejemplo sembrados exitosamente!\n', 'bright');
    log('📊 Resumen:', 'yellow');
    log(`   • 1 usuario: ${phoneNumber}`, 'cyan');
    log(`   • ${categories.length} categorías`, 'cyan');
    log(`   • ${accounts.length} cuentas`, 'cyan');
    log(`   • ${transactions.length} transacciones`, 'cyan');
    log(`   • 1 meta financiera`, 'cyan');
    log(`   • 1 conversación con ${messages.length} mensajes\n`, 'cyan');

  } catch (error) {
    log('\n❌ Error al sembrar datos:', 'red');
    log(error.message, 'red');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar el script
seedDatabase();

