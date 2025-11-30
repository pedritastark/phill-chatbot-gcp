/**
 * Modelo de conversación
 * Representa un mensaje en el historial de conversación
 */
class ConversationMessage {
  constructor(data) {
    this.role = data.role; // 'user' o 'assistant'
    this.content = data.content;
    this.timestamp = data.timestamp || new Date().toISOString();
  }

  /**
   * Valida que el mensaje sea válido
   * @returns {boolean}
   */
  isValid() {
    return (
      this.content &&
      this.content.length > 0 &&
      ['user', 'assistant'].includes(this.role)
    );
  }

  /**
   * Convierte el mensaje a objeto plano
   * @returns {Object}
   */
  toObject() {
    return {
      role: this.role,
      content: this.content,
      timestamp: this.timestamp,
    };
  }

  /**
   * Convierte el mensaje al formato de Gemini API
   * @returns {Object}
   */
  toGeminiFormat() {
    return {
      role: this.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: this.content }],
    };
  }
}

/**
 * Modelo de historial de conversación por usuario
 */
class Conversation {
  constructor(data) {
    this.userId = data.userId;
    this.messages = (data.messages || []).map(
      (msg) => new ConversationMessage(msg)
    );
    this.lastUpdated = data.lastUpdated || new Date().toISOString();
  }

  /**
   * Agrega un mensaje al historial
   * @param {string} role - 'user' o 'assistant'
   * @param {string} content - Contenido del mensaje
   */
  addMessage(role, content) {
    const message = new ConversationMessage({ role, content });
    this.messages.push(message);
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Obtiene los últimos N mensajes
   * @param {number} limit - Número de mensajes a obtener
   * @returns {Array<ConversationMessage>}
   */
  getRecentMessages(limit = 10) {
    return this.messages.slice(-limit);
  }

  /**
   * Limpia mensajes antiguos manteniendo solo los últimos N
   * @param {number} limit - Número de mensajes a mantener
   */
  trimMessages(limit = 10) {
    if (this.messages.length > limit) {
      this.messages = this.messages.slice(-limit);
    }
  }

  /**
   * Convierte la conversación a objeto plano
   * @returns {Object}
   */
  toObject() {
    return {
      userId: this.userId,
      messages: this.messages.map((msg) => msg.toObject()),
      lastUpdated: this.lastUpdated,
    };
  }
}

module.exports = { Conversation, ConversationMessage };

