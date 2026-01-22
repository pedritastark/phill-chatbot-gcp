#!/usr/bin/env node

/**
 * Migration Seed Script
 * 
 * Marks existing migrations as "already applied" without running them.
 * Use this when setting up the migration system on an existing database
 * where tables already exist.
 * 
 * Usage:
 *   node scripts/migrate-seed.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
};

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');

async function seedMigrations() {
    log.info('Seeding migrations table with existing migrations...\n');

    try {
        // Create migrations table if not exists
        await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Get all migration files
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        // Insert each as already applied
        for (const file of files) {
            try {
                await pool.query(
                    'INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
                    [file]
                );
                log.success(`Marked as applied: ${file}`);
            } catch (err) {
                log.warning(`Already exists: ${file}`);
            }
        }

        log.info('\nDone! All existing migrations marked as applied.');
        log.info('Future migrations will run normally with npm run migrate');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

seedMigrations();
