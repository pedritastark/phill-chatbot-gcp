const express = require('express');
const bodyParser = require('body-parser');
const webhookController = require('./controllers/webhook.controller');
const Logger = require('./utils/logger');

/**
 * Configura y retorna la aplicación Express
 */
function createApp() {
  const app = express();

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

  // Rutas
  app.get('/health', webhookController.healthCheck.bind(webhookController));
  app.post('/webhook', webhookController.handleWhatsAppMessage.bind(webhookController));

  // Ruta alternativa para compatibilidad
  app.post('/webhook-whatsapp', webhookController.handleWhatsAppMessage.bind(webhookController));

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

