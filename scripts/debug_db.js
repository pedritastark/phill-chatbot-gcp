require('dotenv').config();
const { query } = require('../src/config/database');

async function check() {
    try {
        console.log('🔍 Checking columns in users table...');
        const res = await query(`
            SELECT table_schema, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'accounts'
            ORDER BY ordinal_position
        `);
        console.log('Columns found:', JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error('❌ Error:', e);
    }
}

check();
