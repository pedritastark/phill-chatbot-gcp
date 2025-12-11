require('dotenv').config();
const { query, closePool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('🚀 Executing Migration 006 (Remove Balance Trigger)...');
        const sql = fs.readFileSync(path.join(__dirname, '../database/migrations/006_remove_balance_trigger.sql'), 'utf8');
        await query(sql);
        console.log('✅ Migration executed successfully.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await closePool();
    }
}

runMigration();
