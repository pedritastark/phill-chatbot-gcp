#!/usr/bin/env node
/**
 * Script para migrar datos de JSON a PostgreSQL
 * Lee los archivos conversations.json y transactions.json y los inserta en la BD
 * 
 * Uso: node scripts/db-migrate.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
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

async function migrateData() {
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
    log('\n🚀 Iniciando migración de datos de JSON a PostgreSQL...', 'bright');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    const client = await pool.connect();

    // Rutas de los archivos JSON
    const conversationsPath = path.join(__dirname, '../data/conversations.json');
    const transactionsPath = path.join(__dirname, '../data/transactions.json');

    // ========================================
    // 1. MIGRAR CONVERSACIONES Y MENSAJES
    // ========================================
    log('📱 Migrando conversaciones y mensajes...', 'blue');
    
    if (fs.existsSync(conversationsPath)) {
      const conversationsData = JSON.parse(fs.readFileSync(conversationsPath, 'utf8'));
      let userCount = 0;
      let messageCount = 0;

      for (const [phoneNumber, convData] of Object.entries(conversationsData)) {
        try {
          // Crear o encontrar usuario
          const userResult = await client.query(
            `INSERT INTO users (phone_number, created_at, last_interaction)
             VALUES ($1, $2, $3)
             ON CONFLICT (phone_number) DO UPDATE 
             SET last_interaction = EXCLUDED.last_interaction
             RETURNING user_id`,
            [phoneNumber, new Date(convData.lastUpdated || new Date()), new Date(convData.lastUpdated || new Date())]
          );
          
          const userId = userResult.rows[0].user_id;
          userCount++;

          // Crear categorías y cuenta predeterminadas
          await createDefaultCategoriesAndAccount(client, userId);

          if (convData.messages && convData.messages.length > 0) {
            // Crear conversación
            const convResult = await client.query(
              `INSERT INTO conversations (user_id, started_at, last_message_at, message_count)
               VALUES ($1, $2, $3, $4)
               RETURNING conversation_id`,
              [
                userId,
                new Date(convData.messages[0].timestamp),
                new Date(convData.lastUpdated),
                convData.messages.length
              ]
            );

            const conversationId = convResult.rows[0].conversation_id;

            // Insertar mensajes
            for (const message of convData.messages) {
              await client.query(
                `INSERT INTO messages (conversation_id, user_id, role, content, created_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                  conversationId,
                  userId,
                  message.role,
                  message.content,
                  new Date(message.timestamp)
                ]
              );
              messageCount++;
            }
          }

          log(`   ✓ Usuario migrado: ${phoneNumber} (${convData.messages?.length || 0} mensajes)`, 'green');
        } catch (error) {
          log(`   ✗ Error migrando usuario ${phoneNumber}: ${error.message}`, 'red');
        }
      }

      log(`\n✅ Migración de conversaciones completada:`, 'green');
      log(`   • ${userCount} usuarios`, 'cyan');
      log(`   • ${messageCount} mensajes\n`, 'cyan');
    } else {
      log('⚠️  Archivo conversations.json no encontrado, saltando...\n', 'yellow');
    }

    // ========================================
    // 2. MIGRAR TRANSACCIONES
    // ========================================
    log('💰 Migrando transacciones...', 'blue');
    
    if (fs.existsSync(transactionsPath)) {
      const transactionsData = JSON.parse(fs.readFileSync(transactionsPath, 'utf8'));
      const transactions = transactionsData.transactions || [];
      let transactionCount = 0;

      for (const transaction of transactions) {
        try {
          // Buscar el usuario
          const userResult = await client.query(
            `SELECT user_id FROM users WHERE phone_number = $1`,
            [transaction.userId]
          );

          if (userResult.rows.length === 0) {
            log(`   ⚠️  Usuario no encontrado: ${transaction.userId}`, 'yellow');
            continue;
          }

          const userId = userResult.rows[0].user_id;

          // Buscar o crear categoría
          const categoryResult = await client.query(
            `INSERT INTO categories (user_id, name, type)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, name, type) DO UPDATE 
             SET name = EXCLUDED.name
             RETURNING category_id`,
            [userId, transaction.category || 'Otros', transaction.type]
          );

          const categoryId = categoryResult.rows[0].category_id;

          // Obtener cuenta predeterminada
          const accountResult = await client.query(
            `SELECT account_id FROM accounts WHERE user_id = $1 AND is_default = true LIMIT 1`,
            [userId]
          );

          const accountId = accountResult.rows.length > 0 ? accountResult.rows[0].account_id : null;

          // Insertar transacción
          await client.query(
            `INSERT INTO transactions (
              user_id,
              account_id,
              category_id,
              type,
              amount,
              description,
              transaction_date,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              userId,
              accountId,
              categoryId,
              transaction.type,
              transaction.amount,
              transaction.description || '',
              new Date(transaction.date),
              new Date(transaction.date)
            ]
          );

          transactionCount++;
        } catch (error) {
          log(`   ✗ Error migrando transacción: ${error.message}`, 'red');
        }
      }

      log(`\n✅ Migración de transacciones completada:`, 'green');
      log(`   • ${transactionCount} transacciones\n`, 'cyan');
    } else {
      log('⚠️  Archivo transactions.json no encontrado, saltando...\n', 'yellow');
    }

    client.release();

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('🎉 ¡Migración completada exitosamente!\n', 'bright');

  } catch (error) {
    log('\n❌ Error durante la migración:', 'red');
    log(error.message, 'red');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Crea categorías y cuenta predeterminadas para un usuario
 */
async function createDefaultCategoriesAndAccount(client, userId) {
  try {
    // Categorías predeterminadas
    const defaultCategories = [
      { name: 'Alimentación', type: 'expense', icon: '🍔', color: '#ef4444' },
      { name: 'Transporte', type: 'expense', icon: '🚗', color: '#f59e0b' },
      { name: 'Salario', type: 'income', icon: '💰', color: '#10b981' },
      { name: 'Otros Gastos', type: 'expense', icon: '💸', color: '#64748b' },
      { name: 'Otros Ingresos', type: 'income', icon: '💵', color: '#14b8a6' },
    ];

    for (const category of defaultCategories) {
      await client.query(
        `INSERT INTO categories (user_id, name, type, icon, color)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, name, type) DO NOTHING`,
        [userId, category.name, category.type, category.icon, category.color]
      );
    }

    // Cuenta predeterminada
    await client.query(
      `INSERT INTO accounts (user_id, name, type, balance, is_default, icon, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [userId, 'Efectivo', 'cash', 0, true, '💵', '#10b981']
    );
  } catch (error) {
    // Silenciar errores de duplicados
  }
}

// Ejecutar el script
migrateData();

