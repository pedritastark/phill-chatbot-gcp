require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'phill_db',
    user: process.env.DB_USER || 'sebastianpedraza',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(poolConfig);

async function runMigration() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '../database/migrations/005_ensure_onboarding_completed.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📦 Executing migration 005...');
        await client.query(sql);
        console.log('✅ Migration 005 applied successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
