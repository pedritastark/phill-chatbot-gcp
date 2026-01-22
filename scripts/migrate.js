#!/usr/bin/env node

/**
 * Migration Runner for Phill
 * 
 * Automatically applies pending database migrations.
 * Tracks applied migrations in a `_migrations` table.
 * 
 * Usage:
 *   node scripts/migrate.js          # Run all pending migrations
 *   node scripts/migrate.js status   # Show migration status
 *   node scripts/migrate.js reset    # Reset migrations table (DANGEROUS)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

const log = {
    info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    dim: (msg) => console.log(`${colors.dim}  ${msg}${colors.reset}`)
};

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Migrations directory
const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');

/**
 * Ensure migrations tracking table exists
 */
async function ensureMigrationsTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations() {
    const result = await pool.query('SELECT name FROM _migrations ORDER BY name');
    return result.rows.map(row => row.name);
}

/**
 * Get list of all migration files
 */
function getMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        log.warning(`Migrations directory not found: ${MIGRATIONS_DIR}`);
        return [];
    }

    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Alphabetical order ensures numeric prefixes work
}

/**
 * Apply a single migration
 */
async function applyMigration(filename) {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filepath, 'utf8');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Execute migration SQL
        await client.query(sql);

        // Record migration as applied
        await client.query(
            'INSERT INTO _migrations (name) VALUES ($1)',
            [filename]
        );

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
    log.info('Phill Database Migration Runner\n');

    try {
        // Ensure tracking table exists
        await ensureMigrationsTable();

        // Get applied and available migrations
        const applied = await getAppliedMigrations();
        const available = getMigrationFiles();

        // Find pending migrations
        const pending = available.filter(m => !applied.includes(m));

        if (pending.length === 0) {
            log.success('Database is up to date. No pending migrations.');
            return;
        }

        log.info(`Found ${pending.length} pending migration(s):\n`);

        for (const migration of pending) {
            log.dim(`Applying: ${migration}`);

            try {
                await applyMigration(migration);
                log.success(`Applied: ${migration}`);
            } catch (error) {
                log.error(`Failed: ${migration}`);
                log.error(error.message);
                process.exit(1);
            }
        }

        log.info('');
        log.success(`Successfully applied ${pending.length} migration(s)`);

    } catch (error) {
        log.error('Migration error:');
        log.error(error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

/**
 * Show migration status
 */
async function showStatus() {
    log.info('Migration Status\n');

    try {
        await ensureMigrationsTable();

        const applied = await getAppliedMigrations();
        const available = getMigrationFiles();

        console.log('Applied migrations:');
        if (applied.length === 0) {
            log.dim('  (none)');
        } else {
            applied.forEach(m => log.success(`  ${m}`));
        }

        console.log('\nPending migrations:');
        const pending = available.filter(m => !applied.includes(m));
        if (pending.length === 0) {
            log.dim('  (none)');
        } else {
            pending.forEach(m => log.warning(`  ${m}`));
        }

    } catch (error) {
        log.error('Error checking status:');
        log.error(error.message);
    } finally {
        await pool.end();
    }
}

/**
 * Reset migrations table (DANGEROUS)
 */
async function resetMigrations() {
    log.warning('This will delete all migration history!');
    log.warning('The actual database tables will NOT be dropped.\n');

    try {
        await pool.query('DROP TABLE IF EXISTS _migrations');
        log.success('Migrations table reset.');
    } catch (error) {
        log.error('Reset error:');
        log.error(error.message);
    } finally {
        await pool.end();
    }
}

// CLI handling
const command = process.argv[2];

switch (command) {
    case 'status':
        showStatus();
        break;
    case 'reset':
        resetMigrations();
        break;
    default:
        runMigrations();
}
