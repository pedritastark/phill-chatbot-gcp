#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
    try {
        console.log('🚀 Iniciando migración de tabla reminders...');
        const client = await pool.connect();

        const migrationPath = path.join(__dirname, '../database/migrations/001_create_reminders_table.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await client.query(sql);
        console.log('✅ Tabla reminders creada exitosamente.');

        client.release();
    } catch (error) {
        console.error('❌ Error en la migración:', error.message);
    } finally {
        await pool.end();
    }
}

runMigration();
