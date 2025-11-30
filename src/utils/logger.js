/**
 * Sistema de logging centralizado
 */
class Logger {
  static log(level, emoji, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${emoji} ${message}`;
    
    console.log(logMessage);
    
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  static info(message, data) {
    this.log('INFO', 'ℹ️', message, data);
  }

  static debug(message, data) {
    // Solo mostrar logs de debug si no estamos en producción
    if (process.env.NODE_ENV !== 'production' && process.env.LOG_LEVEL !== 'warning') {
      this.log('DEBUG', '🔍', message, data);
    }
  }

  static success(message, data) {
    this.log('SUCCESS', '✅', message, data);
  }

  static warning(message, data) {
    this.log('WARNING', '⚠️', message, data);
  }

  static error(message, error) {
    this.log('ERROR', '❌', message, error?.message || error);
    if (error?.stack) {
      console.error(error.stack);
    }
  }

  static request(message, data) {
    this.log('REQUEST', '📥', message, data);
  }

  static response(message, data) {
    this.log('RESPONSE', '📤', message, data);
  }

  static ai(message, data) {
    this.log('AI', '🤖', message, data);
  }

  static finance(message, data) {
    this.log('FINANCE', '💰', message, data);
  }

  static user(message, data) {
    this.log('USER', '👤', message, data);
  }
}

module.exports = Logger;

