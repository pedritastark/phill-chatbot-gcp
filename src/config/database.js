const { Pool } = require('pg');
const Logger = require('../utils/logger');

/**
 * Configuración de la base de datos PostgreSQL
 * 
 * Variables de entorno requeridas:
 * - DATABASE_URL: URL completa de conexión (producción)
 * O individualmente:
 * - DB_HOST: Host de la base de datos
 * - DB_PORT: Puerto de la base de datos
 * - DB_NAME: Nombre de la base de datos
 * - DB_USER: Usuario de la base de datos
 * - DB_PASSWORD: Contraseña de la base de datos
 */

// Configuración del pool de conexiones
const poolConfig = {
  // Opción 1: URL completa (ideal para producción)
  connectionString: process.env.DATABASE_URL,
  
  // Opción 2: Configuración individual (ideal para desarrollo)
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'phill_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  
  // Configuración del pool
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Máximo de conexiones
  min: parseInt(process.env.DB_POOL_MIN || '2'),  // Mínimo de conexiones
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // Tiempo de inactividad
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000'), // Timeout de conexión
  
  // SSL para producción (ej: Heroku, AWS RDS)
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
};

// Crear el pool de conexiones
const pool = new Pool(poolConfig);

// Event handlers para el pool
pool.on('connect', () => {
  Logger.success('Nueva conexión establecida con PostgreSQL');
});

pool.on('error', (err) => {
  Logger.error('Error inesperado en el pool de PostgreSQL', err);
  process.exit(-1);
});

pool.on('remove', () => {
  Logger.info('Conexión removida del pool');
});

/**
 * Verifica la conexión con la base de datos
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    Logger.success('✅ Conexión a PostgreSQL exitosa');
    Logger.info(`🕐 Hora del servidor: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    Logger.error('❌ Error al conectar con PostgreSQL', error);
    Logger.error(`Host: ${poolConfig.host}:${poolConfig.port}`);
    Logger.error(`Database: ${poolConfig.database}`);
    Logger.error(`User: ${poolConfig.user}`);
    return false;
  }
}

/**
 * Ejecuta una query con manejo de errores
 * @param {string} text - Query SQL
 * @param {Array} params - Parámetros de la query
 * @returns {Promise<Object>} - Resultado de la query
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      Logger.warning(`⚠️ Query lenta (${duration}ms): ${text.substring(0, 100)}...`);
    }
    
    return result;
  } catch (error) {
    Logger.error('Error en query de PostgreSQL', error);
    Logger.error(`Query: ${text}`);
    Logger.error(`Params: ${JSON.stringify(params)}`);
    throw error;
  }
}

/**
 * Obtiene un cliente del pool para transacciones
 * @returns {Promise<Object>} - Cliente de PostgreSQL
 */
async function getClient() {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;
  
  // Timeout para transacciones largas
  const timeout = setTimeout(() => {
    Logger.error('Cliente no liberado después de 30 segundos');
  }, 30000);
  
  // Override release para limpiar el timeout
  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return release.apply(client);
  };
  
  return client;
}

/**
 * Ejecuta una transacción
 * @param {Function} callback - Función que recibe el cliente y ejecuta queries
 * @returns {Promise<any>} - Resultado de la transacción
 */
async function transaction(callback) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    Logger.error('Error en transacción, ROLLBACK ejecutado', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cierra el pool de conexiones (útil para testing o shutdown)
 */
async function closePool() {
  await pool.end();
  Logger.info('Pool de conexiones cerrado');
}

/**
 * Obtiene estadísticas del pool
 * @returns {Object} - Estadísticas del pool
 */
function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  testConnection,
  closePool,
  getPoolStats,
};

