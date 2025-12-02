const { Pool } = require('pg');
require('dotenv').config();
const Logger = require('../src/utils/logger');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        Logger.info('🔓 Eliminando restricción de saldo positivo (chk_balance)...');

        // Eliminar el constraint
        await pool.query(`
            ALTER TABLE accounts 
            DROP CONSTRAINT IF EXISTS chk_balance;
        `);

        Logger.success('✅ Restricción eliminada. Ahora se permiten saldos negativos (deudas/sobregiros).');
        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

migrate();
