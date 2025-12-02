const { Pool } = require('pg');
require('dotenv').config();
const Logger = require('../src/utils/logger');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        Logger.info('Iniciando migración de esquema para Modo Discreto...');

        // Agregar columna privacy_mode
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS privacy_mode BOOLEAN DEFAULT FALSE;
        `);

        Logger.success('✅ Columna privacy_mode agregada exitosamente.');
        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

migrate();
