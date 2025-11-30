require('dotenv').config();

/**
 * Configuración centralizada del entorno
 */
const config = {
  // Servidor
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // Google Gemini
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
  },

  // Logs
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Límites de mensajes para WhatsApp Business API
  messaging: {
    // Límite oficial para agentes de IA en WhatsApp
    maxLength: parseInt(process.env.MESSAGE_MAX_LENGTH) || 1024,
    // Margen de seguridad para evitar truncamientos inesperados
    safetyMargin: parseInt(process.env.MESSAGE_SAFETY_MARGIN) || 50,
    // Longitud recomendada para mensajes (optimizado para costos - debe ser estricto)
    recommendedLength: parseInt(process.env.MESSAGE_RECOMMENDED_LENGTH) || 700,
    // Habilitar/deshabilitar división automática de mensajes
    enableAutoSplit: process.env.ENABLE_AUTO_SPLIT !== 'false', // true por defecto
    // Mostrar indicadores de continuación en mensajes divididos
    showContinuationMarkers: process.env.SHOW_CONTINUATION_MARKERS !== 'false',
  },
};

/**
 * Valida que las variables de entorno críticas estén configuradas
 */
function validateConfig() {
  const requiredVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'GEMINI_API_KEY',
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Faltan las siguientes variables de entorno: ${missing.join(', ')}`
    );
  }
}

module.exports = { config, validateConfig };

