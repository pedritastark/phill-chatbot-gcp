require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Logic to parse DATABASE_URL if present (reuse from test script)
if (process.env.DATABASE_URL) {
    try {
        const url = new URL(process.env.DATABASE_URL);
        process.env.DB_HOST = url.hostname;
        process.env.DB_PORT = url.port;
        process.env.DB_USER = url.username;
        process.env.DB_PASSWORD = url.password;
        process.env.DB_NAME = url.pathname.slice(1);
    } catch (err) { }
}

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '../database/migrations/003_remove_goal_constraint.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📦 Executing migration 003...');
        await client.query(sql);
        console.log('✅ Migration 003 applied successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
