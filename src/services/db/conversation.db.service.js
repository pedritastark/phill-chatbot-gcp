const { query, transaction, getClient } = require('../../config/database');
const Logger = require('../../utils/logger');

/**
 * Servicio de base de datos para conversaciones y mensajes
 */
class ConversationDBService {
  /**
   * Obtiene o crea una conversación activa para un usuario
   * @param {string} userId - UUID del usuario
   * @returns {Promise<Object>} - Conversación activa
   */
  async getOrCreateActiveConversation(userId) {
    try {
      // Buscar conversación activa
      let result = await query(
        `SELECT * FROM conversations 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY last_message_at DESC 
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Crear nueva conversación si no existe
      result = await query(
        `INSERT INTO conversations (user_id, started_at, last_message_at, message_count)
         VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
         RETURNING *`,
        [userId]
      );

      Logger.success(`✅ Nueva conversación creada para usuario: ${userId}`);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error al obtener o crear conversación', error);
      throw error;
    }
  }

  /**
   * Agrega un mensaje a una conversación
   * @param {Object} messageData - Datos del mensaje
   * @returns {Promise<Object>} - Mensaje creado
   */
  async addMessage(messageData) {
    try {
      const {
        conversationId,
        userId,
        role,
        content,
        tokensUsed,
        modelUsed,
        responseTimeMs,
        intent,
        entities,
      } = messageData;

      const result = await query(
        `INSERT INTO messages (
          conversation_id,
          user_id,
          role,
          content,
          tokens_used,
          model_used,
          response_time_ms,
          intent,
          entities
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          conversationId,
          userId,
          role,
          content,
          tokensUsed || null,
          modelUsed || null,
          responseTimeMs || null,
          intent || null,
          entities || null,
        ]
      );

      // Actualizar estadísticas de la conversación
      await query(
        `UPDATE conversations 
         SET message_count = message_count + 1,
             last_message_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE conversation_id = $1`,
        [conversationId]
      );

      return result.rows[0];
    } catch (error) {
      Logger.error('Error al agregar mensaje', error);
      throw error;
    }
  }

  /**
   * Obtiene el historial de mensajes de una conversación
   * @param {string} conversationId - UUID de la conversación
   * @param {number} limit - Límite de mensajes
   * @returns {Promise<Array>} - Lista de mensajes
   */
  async getMessages(conversationId, limit = 50) {
    try {
      const result = await query(
        `SELECT * FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [conversationId, limit]
      );

      return result.rows.reverse(); // Invertir para orden cronológico
    } catch (error) {
      Logger.error('Error al obtener mensajes', error);
      throw error;
    }
  }

  /**
   * Obtiene los últimos N mensajes de un usuario (para contexto de IA)
   * @param {string} userId - UUID del usuario
   * @param {number} limit - Límite de mensajes
   * @returns {Promise<Array>} - Lista de mensajes en formato Gemini
   */
  async getRecentMessagesForAI(userId, limit = 10) {
    try {
      const result = await query(
        `SELECT role, content, created_at 
         FROM messages 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
      );

      // Convertir a formato Gemini y revertir orden
      return result.rows.reverse().map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));
    } catch (error) {
      Logger.error('Error al obtener mensajes recientes para IA', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las conversaciones de un usuario
   * @param {string} userId - UUID del usuario
   * @param {boolean} activeOnly - Solo conversaciones activas
   * @returns {Promise<Array>} - Lista de conversaciones
   */
  async getUserConversations(userId, activeOnly = false) {
    try {
      let queryText = `
        SELECT c.*, 
               COUNT(m.message_id) as actual_message_count
        FROM conversations c
        LEFT JOIN messages m ON c.conversation_id = m.conversation_id
        WHERE c.user_id = $1
      `;

      if (activeOnly) {
        queryText += ` AND c.is_active = true`;
      }

      queryText += `
        GROUP BY c.conversation_id
        ORDER BY c.last_message_at DESC
      `;

      const result = await query(queryText, [userId]);
      return result.rows;
    } catch (error) {
      Logger.error('Error al obtener conversaciones del usuario', error);
      throw error;
    }
  }

  /**
   * Cierra una conversación (marca como inactiva)
   * @param {string} conversationId - UUID de la conversación
   */
  async closeConversation(conversationId) {
    try {
      await query(
        `UPDATE conversations 
         SET is_active = false, updated_at = CURRENT_TIMESTAMP 
         WHERE conversation_id = $1`,
        [conversationId]
      );

      Logger.info(`Conversación cerrada: ${conversationId}`);
    } catch (error) {
      Logger.error('Error al cerrar conversación', error);
      throw error;
    }
  }

  /**
   * Actualiza el resumen de contexto de una conversación
   * @param {string} conversationId - UUID de la conversación
   * @param {string} summary - Resumen generado por IA
   * @param {Array} topics - Tópicos detectados
   */
  async updateContext(conversationId, summary, topics = []) {
    try {
      await query(
        `UPDATE conversations 
         SET context_summary = $2,
             topics = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE conversation_id = $1`,
        [conversationId, summary, topics]
      );

      Logger.info(`Contexto actualizado para conversación: ${conversationId}`);
    } catch (error) {
      Logger.error('Error al actualizar contexto', error);
      throw error;
    }
  }

  /**
   * Califica un mensaje (feedback del usuario)
   * @param {string} messageId - UUID del mensaje
   * @param {number} rating - Calificación (1-5)
   * @param {boolean} helpful - Si fue útil
   */
  async rateMessage(messageId, rating = null, helpful = null) {
    try {
      await query(
        `UPDATE messages 
         SET rating = COALESCE($2, rating),
             helpful = COALESCE($3, helpful)
         WHERE message_id = $1`,
        [messageId, rating, helpful]
      );

      Logger.info(`Mensaje calificado: ${messageId}`);
    } catch (error) {
      Logger.error('Error al calificar mensaje', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de conversaciones
   * @param {string} userId - UUID del usuario (opcional)
   * @returns {Promise<Object>} - Estadísticas
   */
  async getStats(userId = null) {
    try {
      let queryText = `
        SELECT 
          COUNT(DISTINCT c.conversation_id) as total_conversations,
          COUNT(DISTINCT c.conversation_id) FILTER (WHERE c.is_active = true) as active_conversations,
          COUNT(m.message_id) as total_messages,
          COUNT(m.message_id) FILTER (WHERE m.role = 'user') as user_messages,
          COUNT(m.message_id) FILTER (WHERE m.role = 'assistant') as assistant_messages,
          COALESCE(AVG(m.tokens_used), 0) as avg_tokens_per_message,
          COALESCE(AVG(m.response_time_ms), 0) as avg_response_time_ms
        FROM conversations c
        LEFT JOIN messages m ON c.conversation_id = m.conversation_id
      `;

      const params = [];
      if (userId) {
        queryText += ` WHERE c.user_id = $1`;
        params.push(userId);
      }

      const result = await query(queryText, params);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error al obtener estadísticas de conversaciones', error);
      throw error;
    }
  }

  /**
   * Busca mensajes por texto
   * @param {string} userId - UUID del usuario
   * @param {string} searchText - Texto a buscar
   * @returns {Promise<Array>} - Lista de mensajes
   */
  async searchMessages(userId, searchText) {
    try {
      const result = await query(
        `SELECT m.*, c.started_at as conversation_started
         FROM messages m
         JOIN conversations c ON m.conversation_id = c.conversation_id
         WHERE m.user_id = $1 AND m.content ILIKE $2
         ORDER BY m.created_at DESC
         LIMIT 50`,
        [userId, `%${searchText}%`]
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error al buscar mensajes', error);
      throw error;
    }
  }

  /**
   * Elimina conversaciones antiguas (limpieza)
   * @param {number} daysOld - Días de antigüedad
   * @returns {Promise<number>} - Número de conversaciones eliminadas
   */
  async cleanupOldConversations(daysOld = 90) {
    try {
      const result = await query(
        `DELETE FROM conversations 
         WHERE is_active = false 
           AND last_message_at < CURRENT_DATE - INTERVAL '${daysOld} days'
         RETURNING conversation_id`,
        []
      );

      const count = result.rows.length;
      Logger.info(`🧹 ${count} conversaciones antiguas eliminadas`);
      return count;
    } catch (error) {
      Logger.error('Error al limpiar conversaciones antiguas', error);
      throw error;
    }
  }
}

module.exports = new ConversationDBService();

