require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Replicate src/config/database.js logic EXACTLY
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'phill_db',
    user: process.env.DB_USER || 'sebastianpedraza',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

// If DATABASE_URL is set, node-postgres uses it and ignores host/port/etc usually, 
// unless connectionString is undefined.
const pool = new Pool(poolConfig);

async function runMigration() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '../database/migrations/004_ensure_onboarding_data.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📦 Executing migration 004...');
        console.log(`🔌 Connected to: ${process.env.DATABASE_URL ? 'DATABASE_URL' : poolConfig.database + ' on ' + poolConfig.host}`);
        await client.query(sql);
        console.log('✅ Migration 004 applied successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
