const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function rebuildSchema() {
    try {
        console.log('⚠️  INICIANDO RECONSTRUCCIÓN DE ESQUEMA ⚠️');
        console.log('Esto BORRARÁ TODAS las tablas y datos y las recreará desde cero.');
        console.log('Esperando 5 segundos... (Ctrl+C para cancelar)');

        await new Promise(resolve => setTimeout(resolve, 5000));

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Borrar todo (Drop Cascade)
            console.log('🗑️  Borrando esquema público...');
            await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
            await client.query('GRANT ALL ON SCHEMA public TO postgres;');
            await client.query('GRANT ALL ON SCHEMA public TO public;');

            // 2. Leer schema.sql
            const schemaPath = path.join(__dirname, '../database/schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');

            // 3. Ejecutar schema.sql
            console.log('🏗️  Creando tablas y funciones...');
            await client.query(schemaSql);

            await client.query('COMMIT');
            console.log('✅ BASE DE DATOS RECONSTRUIDA EXITOSAMENTE.');
            console.log('La estructura está actualizada y limpia.');

        } catch (e) {
            await client.query('ROLLBACK');
            console.error('❌ Error durante la reconstrucción:', e);
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Error de conexión:', error);
    } finally {
        await pool.end();
    }
}

rebuildSchema();
