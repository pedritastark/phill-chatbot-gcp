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
    accountSid: (process.env.TWILIO_ACCOUNT_SID || '').trim().replace(/^['"]|['"]$/g, ''),
    authToken: (process.env.TWILIO_AUTH_TOKEN || '').trim().replace(/^['"]|['"]$/g, ''),
    phoneNumber: (process.env.TWILIO_PHONE_NUMBER || '').trim().replace(/^['"]|['"]$/g, ''),
  },

  // OpenAI
  openai: {
    apiKey: (process.env.OPENAI_API_KEY || '').trim().replace(/^['"]|['"]$/g, ''),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  // Logs
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Límites de mensajes para WhatsApp Business API
  messaging: {
    provider: process.env.MESSAGING_PROVIDER || 'twilio',
    adminPhoneNumber: process.env.ADMIN_PHONE_NUMBER || '+573218372110',
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

  // Rate Limiting & Security
  security: {
    // Máximo de mensajes por ventana de tiempo (spam protection)
    rateLimitWindowMs: 2000, // 2 segundos
    // Límite diario de mensajes por usuario (cost control)
    dailyMessageLimit: parseInt(process.env.DAILY_MESSAGE_LIMIT) || 50,
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'phill_jwt_secret_change_in_production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },

  // CORS Configuration
  cors: {
    allowedOrigins: (process.env.CORS_ORIGINS || 'https://phill-webpage.vercel.app,http://localhost:5173,https://web-production-022a1.up.railway.app').split(','),
  },

  // Modo Mantenimiento
  maintenanceMode: false, // Modo mantenimiento desactivado
};

/**
 * Valida que las variables de entorno críticas estén configuradas
 */
function validateConfig() {
  const requiredVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'OPENAI_API_KEY',
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Faltan las siguientes variables de entorno: ${missing.join(', ')}`
    );
  }
}

module.exports = { config, validateConfig };

