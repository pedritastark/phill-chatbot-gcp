const { Pool } = require('pg');
const { config } = require('../src/config/environment');
const Logger = require('../src/utils/logger');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        Logger.info('Iniciando migración de esquema para Rachas (Streaks)...');

        // Agregar columnas si no existen
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS last_activity_date DATE;
        `);

        Logger.success('✅ Columnas current_streak y last_activity_date agregadas exitosamente.');
        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

migrate();
