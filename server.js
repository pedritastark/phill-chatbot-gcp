const createApp = require('./src/app');
const { config, validateConfig } = require('./src/config/environment');
const { testConnection, getPoolStats } = require('./src/config/database');
const Logger = require('./src/utils/logger');

/**
 * Punto de entrada de la aplicación
 */
async function startServer() {
  try {
    // Validar configuración
    Logger.info('Validando configuración...');
    validateConfig();
    Logger.success('Configuración válida');

    // Verificar conexión a la base de datos
    Logger.info('Verificando conexión a PostgreSQL...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      Logger.warning('⚠️  No se pudo conectar a PostgreSQL. El bot funcionará en modo JSON.');
    }

    // Crear aplicación Express
    const app = createApp();

    // Iniciar servidor
    app.listen(config.port, () => {
      console.log('\n' + '='.repeat(60));
      Logger.success(`🚀 Phill WhatsApp Bot iniciado`);
      Logger.info(`📡 Puerto: ${config.port}`);
      Logger.info(`🌍 Entorno: ${config.nodeEnv}`);
      Logger.info(`🤖 Modelo: ${config.openai.model}`);
      Logger.info(`📍 Webhook: http://localhost:${config.port}/webhook`);
      Logger.info(`💚 Health: http://localhost:${config.port}/health`);

      if (dbConnected) {
        const stats = getPoolStats();
        Logger.info(`🗄️  PostgreSQL: ${stats.total} conexiones activas`);
      }

      console.log('='.repeat(60) + '\n');
      Logger.info('Esperando mensajes de WhatsApp... 💜');
    });

    // Iniciar el planificador de recordatorios
    const ReminderScheduler = require('./src/services/reminder.scheduler');
    ReminderScheduler.start();

  } catch (error) {
    Logger.error('Error al iniciar el servidor', error);
    process.exit(1);
  }
}

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  Logger.error('Excepción no capturada', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Promesa rechazada no manejada', reason);
  process.exit(1);
});

// Iniciar servidor
startServer();

