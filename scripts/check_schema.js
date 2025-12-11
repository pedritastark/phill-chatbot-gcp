require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'phill_db',
    user: process.env.DB_USER || 'sebastianpedraza',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

console.log('🔌 Connecting to DB:', {
    host: poolConfig.host,
    database: poolConfig.database,
    user: poolConfig.user,
    port: poolConfig.port
});

const pool = new Pool(poolConfig);

async function checkSchema() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users';
    `);

        console.log('📋 Existing columns in "users":');
        res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

        // Check for specific columns
        const hasData = res.rows.some(r => r.column_name === 'onboarding_data');
        const hasCompleted = res.rows.some(r => r.column_name === 'onboarding_completed');

        console.log('---------------------');
        console.log(`Checking 'onboarding_data': ${hasData ? '✅ FOUND' : '❌ MISSING'}`);
        console.log(`Checking 'onboarding_completed': ${hasCompleted ? '✅ FOUND' : '❌ MISSING'}`);

        if (!hasData) {
            console.log('🛠️ Attempting to fix missing onboarding_data...');
            await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';");
            console.log('✅ ALTER TABLE executed.');
        }

        if (!hasCompleted) {
            console.log('🛠️ Attempting to fix missing onboarding_completed...');
            await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;");
            console.log('✅ ALTER TABLE executed.');
        }

    } catch (err) {
        console.error('❌ Error checking schema:', err);
    } finally {
        client.release();
        pool.end();
    }
}

checkSchema();
