const { ConversationDBService, UserDBService } = require('./db');
const Logger = require('../utils/logger');

/**
 * Servicio para manejar el historial de conversaciones
 * Usa PostgreSQL como base de datos
 */
class ConversationService {
  constructor() {
    this.maxMessagesPerUser = 10; // Últimos 5 intercambios (5 usuario + 5 bot)
    this.initialized = false;
  }

  /**
   * Inicializa el servicio
   */
  async initialize() {
    if (!this.initialized) {
      Logger.success('Servicio de conversaciones inicializado con PostgreSQL');
      this.initialized = true;
    }
  }

  /**
   * Agrega un mensaje del usuario al historial
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @param {string} message - Mensaje del usuario
   */
  async addUserMessage(phoneNumber, message) {
    try {
      // 1. Buscar o crear el usuario
      const user = await UserDBService.findOrCreate({ phoneNumber });

      // 2. Obtener o crear conversación activa
      const conversation = await ConversationDBService.getOrCreateActiveConversation(user.user_id);

      // 3. Agregar el mensaje
      await ConversationDBService.addMessage({
        conversationId: conversation.conversation_id,
        userId: user.user_id,
        role: 'user',
        content: message,
      });

      Logger.info(`Mensaje de usuario guardado para ${phoneNumber}`);
    } catch (error) {
      Logger.error('Error al guardar mensaje de usuario', error);
    }
  }

  /**
   * Agrega una respuesta del asistente al historial
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @param {string} response - Respuesta del asistente
   * @param {Object} metadata - Metadata adicional (tokens, tiempo, etc.)
   */
  async addAssistantMessage(phoneNumber, response, metadata = {}) {
    try {
      // 1. Buscar el usuario
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        Logger.warning(`Usuario no encontrado: ${phoneNumber}`);
        return;
      }

      // 2. Obtener conversación activa
      const conversation = await ConversationDBService.getOrCreateActiveConversation(user.user_id);

      // 3. Agregar el mensaje
      await ConversationDBService.addMessage({
        conversationId: conversation.conversation_id,
        userId: user.user_id,
        role: 'assistant',
        content: response,
        tokensUsed: metadata.tokensUsed,
        modelUsed: metadata.modelUsed || 'gemini-pro',
        responseTimeMs: metadata.responseTimeMs,
        intent: metadata.intent,
        entities: metadata.entities,
      });

      Logger.info(`Respuesta de asistente guardada para ${phoneNumber}`);
    } catch (error) {
      Logger.error('Error al guardar respuesta de asistente', error);
    }
  }

  /**
   * Obtiene el historial reciente de un usuario
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @param {number} limit - Número de mensajes a obtener
   * @returns {Promise<Array>} - Array de mensajes
   */
  async getRecentHistory(phoneNumber, limit = 10) {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        return [];
      }

      return await ConversationDBService.getRecentMessagesForAI(user.user_id, limit);
    } catch (error) {
      Logger.error('Error al obtener historial reciente', error);
      return [];
    }
  }

  /**
   * Obtiene el historial en formato para Gemini API
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @returns {Promise<Array>} - Array de mensajes en formato Gemini
   */
  getHistoryForGemini(phoneNumber) {
    // Convertir el método a async para usar await
    return this.getRecentHistory(phoneNumber, this.maxMessagesPerUser);
  }

  /**
   * Limpia el historial de un usuario
   * @param {string} phoneNumber - Número de teléfono del usuario
   */
  async clearUserHistory(phoneNumber) {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        Logger.warning(`Usuario no encontrado: ${phoneNumber}`);
        return;
      }

      const conversations = await ConversationDBService.getUserConversations(user.user_id, true);
      
      for (const conversation of conversations) {
        await ConversationDBService.closeConversation(conversation.conversation_id);
      }

      Logger.info(`Historial limpiado para ${phoneNumber}`);
    } catch (error) {
      Logger.error('Error al limpiar historial', error);
    }
  }

  /**
   * Obtiene todas las conversaciones de un usuario
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @returns {Promise<Array>}
   */
  async getUserConversations(phoneNumber) {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        return [];
      }

      return await ConversationDBService.getUserConversations(user.user_id);
    } catch (error) {
      Logger.error('Error al obtener conversaciones del usuario', error);
      return [];
    }
  }

  /**
   * Obtiene los mensajes de una conversación específica
   * @param {string} conversationId - UUID de la conversación
   * @param {number} limit - Límite de mensajes
   * @returns {Promise<Array>}
   */
  async getConversationMessages(conversationId, limit = 50) {
    try {
      return await ConversationDBService.getMessages(conversationId, limit);
    } catch (error) {
      Logger.error('Error al obtener mensajes de conversación', error);
      return [];
    }
  }

  /**
   * Cierra la conversación activa de un usuario
   * @param {string} phoneNumber - Número de teléfono del usuario
   */
  async closeActiveConversation(phoneNumber) {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        return;
      }

      const conversations = await ConversationDBService.getUserConversations(user.user_id, true);
      
      if (conversations.length > 0) {
        await ConversationDBService.closeConversation(conversations[0].conversation_id);
        Logger.info(`Conversación cerrada para ${phoneNumber}`);
      }
    } catch (error) {
      Logger.error('Error al cerrar conversación activa', error);
    }
  }

  /**
   * Obtiene estadísticas de conversaciones
   * @param {string} phoneNumber - Número de teléfono del usuario (opcional)
   * @returns {Promise<Object>}
   */
  async getStats(phoneNumber = null) {
    try {
      if (phoneNumber) {
        const user = await UserDBService.findByPhoneNumber(phoneNumber);
        if (!user) {
          return null;
        }
        return await ConversationDBService.getStats(user.user_id);
      }
      
      return await ConversationDBService.getStats();
    } catch (error) {
      Logger.error('Error al obtener estadísticas de conversaciones', error);
      return null;
    }
  }

  /**
   * Busca mensajes por texto
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @param {string} searchText - Texto a buscar
   * @returns {Promise<Array>}
   */
  async searchMessages(phoneNumber, searchText) {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        return [];
      }

      return await ConversationDBService.searchMessages(user.user_id, searchText);
    } catch (error) {
      Logger.error('Error al buscar mensajes', error);
      return [];
    }
  }

  /**
   * Actualiza el contexto de una conversación
   * @param {string} conversationId - UUID de la conversación
   * @param {string} summary - Resumen generado por IA
   * @param {Array} topics - Tópicos detectados
   */
  async updateContext(conversationId, summary, topics = []) {
    try {
      await ConversationDBService.updateContext(conversationId, summary, topics);
    } catch (error) {
      Logger.error('Error al actualizar contexto', error);
    }
  }

  /**
   * Califica un mensaje
   * @param {string} messageId - UUID del mensaje
   * @param {number} rating - Calificación (1-5)
   * @param {boolean} helpful - Si fue útil
   */
  async rateMessage(messageId, rating = null, helpful = null) {
    try {
      await ConversationDBService.rateMessage(messageId, rating, helpful);
    } catch (error) {
      Logger.error('Error al calificar mensaje', error);
    }
  }
}

module.exports = new ConversationService();
