const { Pool } = require('pg');
require('dotenv').config();
const Logger = require('../src/utils/logger');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        Logger.info('Iniciando migración de esquema para Onboarding...');

        // Agregar columnas de onboarding
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS onboarding_step VARCHAR(50) DEFAULT 'start',
            ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';
        `);

        Logger.success('✅ Columnas de onboarding agregadas exitosamente.');
        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

migrate();
