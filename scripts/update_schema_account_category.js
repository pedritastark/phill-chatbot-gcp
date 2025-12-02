const { Pool } = require('pg');
require('dotenv').config();
const Logger = require('../src/utils/logger');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        Logger.info('Iniciando migración de esquema para Categoría de Cuentas...');

        // Agregar columna category
        await pool.query(`
            ALTER TABLE accounts 
            ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'LIQUIDEZ';
        `);

        Logger.success('✅ Columna category agregada exitosamente.');
        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

migrate();
