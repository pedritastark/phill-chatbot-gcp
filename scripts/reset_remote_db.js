const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function resetDatabase() {
    try {
        console.log('⚠️  INICIANDO RESET DE BASE DE DATOS ⚠️');
        console.log('Esto borrará TODOS los datos de usuarios, cuentas y transacciones.');
        console.log('Esperando 5 segundos... (Ctrl+C para cancelar)');

        await new Promise(resolve => setTimeout(resolve, 5000));

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Orden importante por claves foráneas
            console.log('🗑️  Borrando transacciones...');
            await client.query('TRUNCATE TABLE transactions CASCADE');

            console.log('🗑️  Borrando recordatorios...');
            await client.query('TRUNCATE TABLE reminders CASCADE');

            console.log('🗑️  Borrando cuentas...');
            await client.query('TRUNCATE TABLE accounts CASCADE');

            console.log('🗑️  Borrando categorías personalizadas...');
            await client.query('TRUNCATE TABLE categories CASCADE');

            console.log('🗑️  Borrando usuarios...');
            await client.query('TRUNCATE TABLE users CASCADE');

            await client.query('COMMIT');
            console.log('✅ BASE DE DATOS LIMPIA. Todos los usuarios son nuevos ahora.');

        } catch (e) {
            await client.query('ROLLBACK');
            console.error('❌ Error durante el reset:', e);
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Error de conexión:', error);
    } finally {
        await pool.end();
    }
}

resetDatabase();
