require('dotenv').config();
const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');
const Logger = require('../src/utils/logger');

async function migrate() {
    try {
        Logger.info('🚀 Iniciando migración de estado de usuario...');

        const migrationPath = path.join(__dirname, '../database/migrations/003_add_user_action_state.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(migrationSql);

        Logger.success('✅ Migración completada: Campos de estado agregados a la tabla users');
        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en la migración', error);
        process.exit(1);
    }
}

migrate();
