const MessageService = require('../services/message.service');
const RateLimitService = require('../services/rate.limit.service');
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

      // 0. Modo Mantenimiento (Sleep Mode)
      if (config.maintenanceMode) {
        const maintenanceMsg = "🚧 En este momento el jefe está trabajando en el proyecto. Mándale un DM si necesitas algo urgente. 💜";
        const twiml = TwiMLHelper.generateSmartResponse(maintenanceMsg);
        return res.type('text/xml').send(twiml);
      }

      // 0.1. Verificar Rate Limits & Seguridad
      const limitCheck = RateLimitService.checkLimit(from);
      if (!limitCheck.allowed) {
        let reply = '';
        if (limitCheck.reason === 'rate_limit') {
          reply = '¡Epa! Vas muy rápido. 🏎️ Déjame pensar un segundo. ✋';
        } else if (limitCheck.reason === 'daily_limit') {
          reply = 'Has alcanzado tu límite diario de mensajes. 🌙 ¡Hablamos mañana! (O contacta soporte si es urgente). 💜';
        }
        const twiml = TwiMLHelper.generateSmartResponse(reply);
        return res.type('text/xml').send(twiml);
      }

      // Validar el mensaje
      const validation = MessageService.validateMessage(message);

      if (!validation.valid) {
        const twiml = this.handleInvalidMessage(validation.error);
        return res.type('text/xml').send(twiml);
      }

      // Procesar el mensaje
      const response = await MessageService.processMessage(message, from);

      // NUEVO: Soporte para botones interactivos (Bypasses TwiML)
      if (typeof response === 'object' && response.buttons) {
        const WhatsappService = require('../services/whatsapp.service');
        await WhatsappService.sendButtonMessage(from, response.message, response.buttons);

        // Retornar TwiML vacío para confirmar recepción a Twilio
        // (El mensaje ya se envió vía API)
        Logger.response('🔘  Respuesta con botones enviada vía API');
        return res.type('text/xml').send('<Response></Response>');
      }

      // Análisis de longitud de respuesta
      const responseLength = typeof response === 'string' ? response.length : (response.message || '').length;
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
      let twiml;
      if (typeof response === 'object' && response.mediaUrl) {
        // Es una respuesta con multimedia
        twiml = TwiMLHelper.generateMediaResponse(response.message, response.mediaUrl);
      } else {
        // Es una respuesta de texto normal
        twiml = TwiMLHelper.generateSmartResponse(response);
      }

      Logger.response('✉️  Respuesta enviada exitosamente');
      const logMsg = typeof response === 'object' ? response.message : response;
      Logger.info(`Preview: "${logMsg.substring(0, 100)}${logMsg.length > 100 ? '...' : ''}"`);
      Logger.debug(`TwiML: ${twiml}`); // Debug log

      return res.set('Content-Type', 'text/xml').send(twiml.toString());

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

