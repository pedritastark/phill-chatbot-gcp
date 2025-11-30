const MessageService = require('../services/message.service');
const TwiMLHelper = require('../utils/twiml');
const Logger = require('../utils/logger');
const { config } = require('../config/environment');

/**
 * Controlador del webhook de Twilio
 */
class WebhookController {
  /**
   * Maneja las peticiones POST del webhook de WhatsApp
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  async handleWhatsAppMessage(req, res) {
    try {
      Logger.request('Mensaje recibido de Twilio');

      // Extraer datos del request de Twilio
      const message = req.body.Body || '';
      const from = req.body.From || '';
      const to = req.body.To || '';

      Logger.user(`De: ${from}`);
      Logger.user(`Para: ${to}`);
      Logger.info(`Mensaje: "${message}"`);
      Logger.info(`Longitud: ${message.length} caracteres`);

      // Validar el mensaje
      const validation = MessageService.validateMessage(message);

      if (!validation.valid) {
        const twiml = this.handleInvalidMessage(validation.error);
        return res.type('text/xml').send(twiml);
      }

      // Procesar el mensaje
      const response = await MessageService.processMessage(message, from);

      // Análisis de longitud de respuesta
      const responseLength = response.length;
      const safeLimit = config.messaging.maxLength - config.messaging.safetyMargin;
      
      Logger.info(`📏 Longitud de respuesta: ${responseLength} caracteres`);
      
      // Logs de diagnóstico según el tamaño
      if (responseLength <= config.messaging.recommendedLength) {
        Logger.success(`✅ Mensaje dentro del límite recomendado (${config.messaging.recommendedLength} caracteres)`);
      } else if (responseLength <= safeLimit) {
        Logger.warning(`⚠️  Mensaje cercano al límite (${safeLimit} caracteres)`);
      } else {
        Logger.warning(`🚨 Mensaje excede el límite seguro - se dividirá automáticamente`);
        const estimatedChunks = Math.ceil(responseLength / safeLimit);
        Logger.info(`📦 Estimado de partes: ${estimatedChunks}`);
      }

      // Generar respuesta TwiML inteligente (divide automáticamente si es necesario)
      const twiml = TwiMLHelper.generateSmartResponse(response);
      
      Logger.response('✉️  Respuesta enviada exitosamente');
      Logger.info(`Preview: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);
      
      return res.type('text/xml').send(twiml);

    } catch (error) {
      Logger.error('Error en el webhook', error);
      
      const twiml = TwiMLHelper.generateErrorResponse();
      return res.type('text/xml').send(twiml);
    }
  }

  /**
   * Maneja mensajes inválidos
   * @param {string} errorType - Tipo de error
   * @returns {string} - TwiML response
   */
  handleInvalidMessage(errorType) {
    Logger.warning(`Mensaje inválido: ${errorType}`);

    switch (errorType) {
      case 'empty':
        return TwiMLHelper.generateEmptyMessageResponse();
      case 'too_short':
        return TwiMLHelper.generateShortMessageResponse();
      default:
        return TwiMLHelper.generateErrorResponse();
    }
  }

  /**
   * Health check endpoint
   * @param {Object} req - Request de Express
   * @param {Object} res - Response de Express
   */
  healthCheck(req, res) {
    res.json({
      status: 'ok',
      message: 'Phill WhatsApp Bot is running',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = new WebhookController();

