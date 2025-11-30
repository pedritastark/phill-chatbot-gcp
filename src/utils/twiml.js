const twilio = require('twilio');
const { config } = require('../config/environment');
const Logger = require('./logger');

/**
 * Utilidades para generar respuestas TwiML
 */
class TwiMLHelper {
  /**
   * Genera una respuesta TwiML con un mensaje
   * @param {string} message - El mensaje a enviar
   * @returns {string} - XML TwiML
   */
  static generateResponse(message) {
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(message);
    return twiml.toString();
  }

  /**
   * Genera respuestas TwiML para múltiples mensajes
   * Útil cuando necesitas enviar varios mensajes seguidos
   * @param {string[]} messages - Array de mensajes a enviar
   * @returns {string} - XML TwiML con múltiples mensajes
   */
  static generateMultipleResponses(messages) {
    const twiml = new twilio.twiml.MessagingResponse();
    messages.forEach(msg => twiml.message(msg));
    return twiml.toString();
  }

  /**
   * Divide un mensaje largo en partes más pequeñas respetando el límite de caracteres
   * La división intenta mantener la coherencia del texto dividiendo por párrafos y oraciones
   * @param {string} message - El mensaje original
   * @param {number} maxLength - Longitud máxima por mensaje (default: configurado en environment)
   * @returns {string[]} - Array de mensajes divididos
   */
  static splitMessage(message, maxLength = config.messaging.maxLength) {
    // Usar un límite más conservador para evitar problemas
    const safeMaxLength = maxLength - config.messaging.safetyMargin;

    Logger.debug(`Dividiendo mensaje de ${message.length} caracteres (límite: ${safeMaxLength})`);

    // Si el mensaje cabe en un solo envío, retornarlo directamente
    if (message.length <= safeMaxLength) {
      return [message];
    }

    const chunks = [];
    let currentChunk = '';

    // Estrategia 1: Dividir por párrafos (saltos de línea)
    const paragraphs = message.split('\n');

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const nextLine = paragraph + (i < paragraphs.length - 1 ? '\n' : '');

      // Si agregar este párrafo no excede el límite, agregarlo
      if ((currentChunk + nextLine).length <= safeMaxLength) {
        currentChunk += nextLine;
      } else {
        // Guardar el chunk actual si tiene contenido
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        // Si el párrafo solo es muy largo, dividirlo por oraciones
        if (paragraph.length > safeMaxLength) {
          const sentences = this._splitByPeriods(paragraph);
          
          for (const sentence of sentences) {
            if ((currentChunk + sentence).length <= safeMaxLength) {
              currentChunk += sentence;
            } else {
              if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
              }
              
              // Si incluso una oración es muy larga, dividirla por palabras
              if (sentence.length > safeMaxLength) {
                const wordChunks = this._splitByWords(sentence, safeMaxLength);
                chunks.push(...wordChunks.slice(0, -1));
                currentChunk = wordChunks[wordChunks.length - 1];
              } else {
                currentChunk = sentence;
              }
            }
          }
        } else {
          currentChunk = nextLine;
        }
      }
    }

    // Agregar el último chunk si tiene contenido
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Logging de división de mensajes
    if (chunks.length > 1) {
      Logger.info(`📨 Mensaje dividido en ${chunks.length} partes`);
      chunks.forEach((chunk, index) => {
        Logger.debug(`  └─ Parte ${index + 1}: ${chunk.length} caracteres`);
      });
    }

    // Agregar indicadores de continuación para mejor UX (si está habilitado)
    if (config.messaging.showContinuationMarkers) {
      return this._addContinuationMarkers(chunks);
    }
    
    return chunks;
  }

  /**
   * Divide un texto por puntos, signos de exclamación e interrogación
   * @private
   * @param {string} text - Texto a dividir
   * @returns {string[]} - Array de oraciones
   */
  static _splitByPeriods(text) {
    // Dividir por puntos, signos de interrogación y exclamación
    const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g);
    
    if (!sentences) {
      return [text];
    }

    return sentences;
  }

  /**
   * Divide un texto por palabras cuando es necesario
   * @private
   * @param {string} text - Texto a dividir
   * @param {number} maxLength - Longitud máxima
   * @returns {string[]} - Array de chunks
   */
  static _splitByWords(text, maxLength) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';

    for (const word of words) {
      if ((currentChunk + word + ' ').length <= maxLength) {
        currentChunk += word + ' ';
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = word + ' ';
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text.substring(0, maxLength)];
  }

  /**
   * Agrega marcadores de continuación a los mensajes divididos
   * @private
   * @param {string[]} chunks - Array de mensajes
   * @returns {string[]} - Array de mensajes con marcadores
   */
  static _addContinuationMarkers(chunks) {
    if (chunks.length <= 1) {
      return chunks;
    }

    return chunks.map((chunk, index) => {
      if (index === 0) {
        // Primer mensaje: agregar indicador de continuación
        return `${chunk}\n\n📨 (continúa...)`;
      } else if (index === chunks.length - 1) {
        // Último mensaje: agregar indicador de finalización
        return `📨 (...continuación)\n\n${chunk}`;
      } else {
        // Mensajes intermedios
        return `📨 (...continuación)\n\n${chunk}\n\n📨 (continúa...)`;
      }
    });
  }

  /**
   * Genera una respuesta de error genérica
   * @returns {string} - XML TwiML
   */
  static generateErrorResponse() {
    return this.generateResponse(
      'Lo siento, ocurrió un error al procesar tu mensaje. Por favor, inténtalo más tarde. 💜'
    );
  }

  /**
   * Genera una respuesta para mensajes vacíos
   * @returns {string} - XML TwiML
   */
  static generateEmptyMessageResponse() {
    return this.generateResponse(
      'Lo siento, no recibí ningún mensaje. Por favor, inténtalo de nuevo.'
    );
  }

  /**
   * Genera una respuesta para mensajes muy cortos
   * @returns {string} - XML TwiML
   */
  static generateShortMessageResponse() {
    return this.generateResponse(
      'Hmm, creo que no capté bien tu mensaje. ¿Podrías ser más específico? Por ejemplo: "¿Qué es un ETF?" o "Registrar gasto: $50 comida". 💜'
    );
  }

  /**
   * Genera una respuesta TwiML manejando automáticamente mensajes largos
   * Si el mensaje excede el límite, lo divide y envía múltiples mensajes
   * @param {string} message - El mensaje a enviar
   * @returns {string} - XML TwiML
   */
  static generateSmartResponse(message) {
    const messageLength = message.length;
    
    // Log de advertencia si el mensaje se acerca al límite recomendado
    if (messageLength > config.messaging.recommendedLength) {
      Logger.warning(`⚠️  Mensaje largo detectado: ${messageLength} caracteres (recomendado: ${config.messaging.recommendedLength})`);
    }

    // Si la división automática está deshabilitada, enviar como está
    if (!config.messaging.enableAutoSplit) {
      Logger.debug('División automática deshabilitada, enviando mensaje completo');
      return this.generateResponse(message);
    }

    const chunks = this.splitMessage(message);
    
    if (chunks.length === 1) {
      Logger.debug(`✅ Mensaje dentro del límite: ${messageLength} caracteres`);
      return this.generateResponse(message);
    }
    
    Logger.success(`✅ Mensaje dividido exitosamente en ${chunks.length} partes`);
    return this.generateMultipleResponses(chunks);
  }
}

module.exports = TwiMLHelper;

