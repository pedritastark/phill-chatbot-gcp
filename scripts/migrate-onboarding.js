require('dotenv').config();
const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');
const Logger = require('../src/utils/logger');

async function migrate() {
    try {
        Logger.info('🚀 Iniciando migración de onboarding...');

        const migrationPath = path.join(__dirname, '../database/migrations/002_add_onboarding_fields.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(migrationSql);

        Logger.success('✅ Migración completada: Campos de onboarding agregados a la tabla users');
        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en la migración', error);
        process.exit(1);
    }
}

migrate();
