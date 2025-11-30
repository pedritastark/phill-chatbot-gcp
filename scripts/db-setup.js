#!/usr/bin/env node
/**
 * Script para configurar la base de datos PostgreSQL
 * Crea las tablas, índices, triggers y vistas necesarias
 * 
 * Uso: node scripts/db-setup.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function setupDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'phill_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    log('\n🚀 Iniciando configuración de la base de datos...', 'bright');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    // 1. Probar conexión
    log('📡 Probando conexión con PostgreSQL...', 'blue');
    const client = await pool.connect();
    log('✅ Conexión exitosa\n', 'green');

    // 2. Leer el archivo schema.sql
    log('📄 Leyendo archivo schema.sql...', 'blue');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Archivo schema.sql no encontrado en: ${schemaPath}`);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    log('✅ Schema leído correctamente\n', 'green');

    // 3. Ejecutar el schema
    log('🔨 Creando tablas, índices y triggers...', 'blue');
    await client.query(schema);
    log('✅ Base de datos configurada correctamente\n', 'green');

    // 4. Verificar tablas creadas
    log('🔍 Verificando tablas creadas...', 'blue');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = result.rows.map(row => row.table_name);
    log(`✅ ${tables.length} tablas creadas:\n`, 'green');
    tables.forEach(table => log(`   • ${table}`, 'cyan'));

    // 5. Verificar vistas creadas
    log('\n🔍 Verificando vistas creadas...', 'blue');
    const viewsResult = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const views = viewsResult.rows.map(row => row.table_name);
    log(`✅ ${views.length} vistas creadas:\n`, 'green');
    views.forEach(view => log(`   • ${view}`, 'cyan'));

    client.release();

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('🎉 ¡Base de datos configurada exitosamente!\n', 'bright');
    log('Próximos pasos:', 'yellow');
    log('  1. Ejecutar: npm run db:migrate (para migrar datos existentes)', 'yellow');
    log('  2. O ejecutar: npm run db:seed (para datos de ejemplo)', 'yellow');
    log('  3. Iniciar el servidor: npm start\n', 'yellow');

  } catch (error) {
    log('\n❌ Error al configurar la base de datos:', 'red');
    log(error.message, 'red');
    
    if (error.code) {
      log(`\nCódigo de error: ${error.code}`, 'yellow');
    }
    
    if (error.code === 'ECONNREFUSED') {
      log('\n💡 Sugerencia: Asegúrate de que PostgreSQL esté ejecutándose', 'yellow');
      log('   y que las credenciales en .env sean correctas\n', 'yellow');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar el script
setupDatabase();

