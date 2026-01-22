const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');
const Logger = require('../src/utils/logger');

async function runMigration() {
    try {
        const migrationPath = path.join(__dirname, '../database/migrations/007_refine_transactions.sql');
        Logger.info(`Leyendo migración: ${migrationPath}`);

        const sql = fs.readFileSync(migrationPath, 'utf8');

        Logger.info('Ejecutando SQL...');
        await query(sql);

        Logger.success('✅ Migración 007 ejecutada correctamente.');
    } catch (error) {
        Logger.error('❌ Error ejecutando migración', error);
    } finally {
        await closePool();
    }
}

runMigration();
