const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const webhookController = require('./controllers/webhook.controller');
const apiRoutes = require('./routes/api.routes');
const { config } = require('./config/environment');
const Logger = require('./utils/logger');

/**
 * Configura y retorna la aplicación Express
 */
function createApp() {
  const app = express();

  // CORS Configuration for Web Dashboard
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (config.cors.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        Logger.warning(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Middlewares
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  // Middleware de logging para todas las peticiones
  app.use((req, res, next) => {
    Logger.info(`${req.method} ${req.path}`);
    next();
  });

  // Servir archivos estáticos (para reportes PDF)
  const path = require('path');
  app.use('/public', express.static(path.join(__dirname, '../public')));

  // ==========================================
  // API Routes for Web Dashboard
  // ==========================================
  app.use('/api/v1', apiRoutes);

  // Rutas
  app.get('/health', webhookController.healthCheck.bind(webhookController));
  app.post('/webhook', webhookController.handleWhatsAppMessage.bind(webhookController));

  // Ruta alternativa para compatibilidad
  app.post('/webhook-whatsapp', webhookController.handleWhatsAppMessage.bind(webhookController));

  // --- RUTA TEMPORAL DE ADMINISTRACIÓN ---
  app.get('/admin/reset-db-dangerous', async (req, res) => {
    const { key } = req.query;
    if (key !== 'phill_secret_reset_2025') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
      const { query } = require('./config/database');
      Logger.warning('⚠️ INICIANDO RESET DE BASE DE DATOS REMOTA ⚠️');

      await query('DELETE FROM transactions');
      await query('DELETE FROM reminders');
      await query('DELETE FROM accounts');
      await query('DELETE FROM categories');
      await query('DELETE FROM conversations');
      await query('DELETE FROM users');

      Logger.success('✅ Base de datos reiniciada correctamente');
      res.json({ status: 'success', message: 'Database reset complete. All users deleted.' });
    } catch (error) {
      Logger.error('Error resetting DB', error);
      res.status(500).json({ error: error.message });
    }
  });
  // ---------------------------------------

  // Manejador de rutas no encontradas
  app.use((req, res) => {
    Logger.warning(`Ruta no encontrada: ${req.method} ${req.path}`);
    res.status(404).json({
      error: 'Not Found',
      message: `La ruta ${req.path} no existe`,
    });
  });

  // Manejador de errores global
  app.use((err, req, res, next) => {
    Logger.error('Error no manejado', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Ocurrió un error en el servidor',
    });
  });

  return app;
}

module.exports = createApp;

