const { query, transaction } = require('../../config/database');
const Logger = require('../../utils/logger');

/**
 * Servicio de base de datos para la tabla transactions
 */
class TransactionDBService {
  /**
   * Crea una nueva transacción
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Promise<Object>} - Transacción creada
   */
  async create(transactionData) {
    try {
      const {
        userId,
        accountId,
        categoryId,
        type,
        amount,
        description,
        transactionDate,
        notes,
        tags,
        isRecurring,
        recurringFrequency,
        detectedByAI,
        confidenceScore,
        currency,
        status
      } = transactionData;

      const result = await query(
        `INSERT INTO transactions (
          user_id,
          account_id,
          category_id,
          type,
          amount,
          description,
          transaction_date,
          notes,
          tags,
          is_recurring,
          recurring_frequency,
          detected_by_ai,
          confidence_score,
          currency,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          userId,
          accountId || null,
          categoryId || null,
          type,
          amount,
          description,
          transactionDate || new Date(),
          notes || null,
          tags || null,
          isRecurring || false,
          recurringFrequency || null,
          detectedByAI || false,
          confidenceScore || null,
          currency || 'COP',
          status || 'completed'
        ]
      );

      Logger.success(`✅ Transacción creada: ${type} - $${amount}`);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error al crear transacción', error);
      throw error;
    }
  }

  /**
   * Obtiene una transacción por su ID
   * @param {string} transactionId - UUID de la transacción
   * @returns {Promise<Object|null>} - Transacción o null
   */
  async findById(transactionId) {
    try {
      const result = await query(
        `SELECT t.*, 
                c.name as category_name,
                a.name as account_name,
                u.phone_number
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.category_id
         LEFT JOIN accounts a ON t.account_id = a.account_id
         LEFT JOIN users u ON t.user_id = u.user_id
         WHERE t.transaction_id = $1 AND t.is_deleted = false`,
        [transactionId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error al buscar transacción', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las transacciones de un usuario
   * @param {string} userId - UUID del usuario
   * @param {Object} filters - Filtros opcionales
   * @returns {Promise<Array>} - Lista de transacciones
   */
  async findByUser(userId, filters = {}) {
    try {
      const { type, categoryId, startDate, endDate, limit = 50, offset = 0 } = filters;

      let queryText = `
        SELECT t.*, 
               c.name as category_name,
               c.color as category_color,
               c.icon as category_icon,
               a.name as account_name,
               a.type as account_type
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.category_id
        LEFT JOIN accounts a ON t.account_id = a.account_id
        WHERE t.user_id = $1 AND t.is_deleted = false
      `;

      const params = [userId];
      let paramIndex = 2;

      if (type) {
        queryText += ` AND t.type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      if (categoryId) {
        queryText += ` AND t.category_id = $${paramIndex}`;
        params.push(categoryId);
        paramIndex++;
      }

      if (startDate) {
        queryText += ` AND t.transaction_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        queryText += ` AND t.transaction_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      queryText += ` ORDER BY t.transaction_date DESC, t.created_at DESC`;
      queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      Logger.error('Error al buscar transacciones del usuario', error);
      throw error;
    }
  }

  /**
   * Obtiene el resumen de transacciones de un usuario en un periodo
   * @param {string} userId - UUID del usuario
   * @param {string} period - Periodo: 'day', 'week', 'month', 'year', 'all'
   * @returns {Promise<Object>} - Resumen de transacciones
   */
  async getSummary(userId, period = 'month') {
    try {
      let dateFilter = '';

      switch (period) {
        case 'day':
          dateFilter = "AND transaction_date >= CURRENT_DATE";
          break;
        case 'week':
          dateFilter = "AND transaction_date >= CURRENT_DATE - INTERVAL '7 days'";
          break;
        case 'month':
          dateFilter = "AND transaction_date >= CURRENT_DATE - INTERVAL '30 days'";
          break;
        case 'year':
          dateFilter = "AND transaction_date >= CURRENT_DATE - INTERVAL '1 year'";
          break;
        case 'all':
        default:
          dateFilter = '';
      }

      const result = await query(
        `SELECT 
          COUNT(*) as transaction_count,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance,
          COALESCE(AVG(CASE WHEN type = 'expense' THEN amount END), 0) as avg_expense,
          COALESCE(AVG(CASE WHEN type = 'income' THEN amount END), 0) as avg_income
         FROM transactions
         WHERE user_id = $1 AND is_deleted = false ${dateFilter}`,
        [userId]
      );

      return result.rows[0];
    } catch (error) {
      Logger.error('Error al obtener resumen de transacciones', error);
      throw error;
    }
  }

  /**
   * Obtiene transacciones agrupadas por categoría
   * @param {string} userId - UUID del usuario
   * @param {string} period - Periodo
   * @returns {Promise<Array>} - Transacciones agrupadas
   */
  async getByCategory(userId, period = 'month') {
    try {
      let dateFilter = '';

      switch (period) {
        case 'day':
          dateFilter = "AND t.transaction_date >= CURRENT_DATE";
          break;
        case 'week':
          dateFilter = "AND t.transaction_date >= CURRENT_DATE - INTERVAL '7 days'";
          break;
        case 'month':
          dateFilter = "AND t.transaction_date >= CURRENT_DATE - INTERVAL '30 days'";
          break;
        case 'year':
          dateFilter = "AND t.transaction_date >= CURRENT_DATE - INTERVAL '1 year'";
          break;
        default:
          dateFilter = '';
      }

      const result = await query(
        `SELECT 
          c.category_id,
          c.name as category_name,
          c.type as category_type,
          c.icon as category_icon,
          c.color as category_color,
          COUNT(t.transaction_id) as transaction_count,
          SUM(t.amount) as total_amount,
          AVG(t.amount) as avg_amount,
          MIN(t.amount) as min_amount,
          MAX(t.amount) as max_amount
         FROM transactions t
         JOIN categories c ON t.category_id = c.category_id
         WHERE t.user_id = $1 AND t.is_deleted = false ${dateFilter}
         GROUP BY c.category_id, c.name, c.type, c.icon, c.color
         ORDER BY total_amount DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error al obtener transacciones por categoría', error);
      throw error;
    }
  }

  /**
   * Obtiene las últimas N transacciones de un usuario
   * @param {string} userId - UUID del usuario
   * @param {number} limit - Límite de transacciones
   * @returns {Promise<Array>} - Lista de transacciones
   */
  async getRecent(userId, limit = 10) {
    try {
      const result = await query(
        `SELECT t.*, 
                c.name as category_name,
                c.icon as category_icon,
                c.color as category_color,
                a.name as account_name
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.category_id
         LEFT JOIN accounts a ON t.account_id = a.account_id
         WHERE t.user_id = $1 AND t.is_deleted = false
         ORDER BY t.transaction_date DESC, t.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error al obtener transacciones recientes', error);
      throw error;
    }
  }

  /**
   * Actualiza una transacción
   * @param {string} transactionId - UUID de la transacción
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} - Transacción actualizada
   */
  async update(transactionId, updateData) {
    try {
      const {
        accountId,
        categoryId,
        amount,
        description,
        transactionDate,
        notes,
        tags,
      } = updateData;

      const result = await query(
        `UPDATE transactions SET
          account_id = COALESCE($2, account_id),
          category_id = COALESCE($3, category_id),
          amount = COALESCE($4, amount),
          description = COALESCE($5, description),
          transaction_date = COALESCE($6, transaction_date),
          notes = COALESCE($7, notes),
          tags = COALESCE($8, tags),
          updated_at = CURRENT_TIMESTAMP
         WHERE transaction_id = $1 AND is_deleted = false
         RETURNING *`,
        [
          transactionId,
          accountId,
          categoryId,
          amount,
          description,
          transactionDate,
          notes,
          tags,
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Transacción no encontrada');
      }

      Logger.success(`✅ Transacción actualizada: ${transactionId}`);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error al actualizar transacción', error);
      throw error;
    }
  }

  /**
   * Elimina una transacción (soft delete)
   * @param {string} transactionId - UUID de la transacción
   */
  async delete(transactionId) {
    try {
      await query(
        `UPDATE transactions 
         SET is_deleted = true, updated_at = CURRENT_TIMESTAMP 
         WHERE transaction_id = $1`,
        [transactionId]
      );

      Logger.info(`Transacción eliminada (soft delete): ${transactionId}`);
    } catch (error) {
      Logger.error('Error al eliminar transacción', error);
      throw error;
    }
  }

  /**
   * Elimina permanentemente una transacción (hard delete)
   * @param {string} transactionId - UUID de la transacción
   */
  async hardDelete(transactionId) {
    try {
      await query(
        `DELETE FROM transactions WHERE transaction_id = $1`,
        [transactionId]
      );

      Logger.warning(`⚠️ Transacción eliminada permanentemente: ${transactionId}`);
    } catch (error) {
      Logger.error('Error al eliminar transacción permanentemente', error);
      throw error;
    }
  }

  /**
   * Obtiene el balance total de un usuario
   * @param {string} userId - UUID del usuario
   * @returns {Promise<number>} - Balance total
   */
  async getBalance(userId) {
    try {
      const result = await query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance
         FROM transactions
         WHERE user_id = $1 AND is_deleted = false`,
        [userId]
      );

      return parseFloat(result.rows[0].balance);
    } catch (error) {
      Logger.error('Error al obtener balance', error);
      throw error;
    }
  }

  /**
   * Busca transacciones por texto
   * @param {string} userId - UUID del usuario
   * @param {string} searchText - Texto a buscar
   * @returns {Promise<Array>} - Lista de transacciones
   */
  async search(userId, searchText) {
    try {
      const result = await query(
        `SELECT t.*, 
                c.name as category_name,
                a.name as account_name
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.category_id
         LEFT JOIN accounts a ON t.account_id = a.account_id
         WHERE t.user_id = $1 
           AND t.is_deleted = false
           AND (
             t.description ILIKE $2 OR
             t.notes ILIKE $2 OR
             c.name ILIKE $2
           )
         ORDER BY t.transaction_date DESC
         LIMIT 50`,
        [userId, `%${searchText}%`]
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error al buscar transacciones', error);
      throw error;
    }
  }

  /**
   * Obtiene transacciones pendientes de pago hasta una fecha dada
   * @param {string} dateLimit - Fecha límite (YYYY-MM-DD)
   * @returns {Promise<Array>}
   */
  async getPendingDue(dateLimit) {
    try {
      // Postgres compara date directamente si es formato ISO YYYY-MM-DD
      const result = await query(
        `SELECT t.*, u.phone_number
         FROM transactions t
         JOIN users u ON t.user_id = u.user_id
         WHERE t.status = 'pending'
         AND t.is_deleted = false
         AND DATE(t.transaction_date) <= $1`,
        [dateLimit]
      );
      return result.rows;
    } catch (error) {
      Logger.error('Error obteniendo pendientes vencidos', error);
      throw error;
    }
  }

  /**
   * Busca si existe una transacción pendiente similar (para conciliación)
   * @param {string} userId
   * @param {number} amount
   * @param {string} descriptionFragment
   * @returns {Promise<Object|null>}
   */
  async findPendingMatch(userId, amount, descriptionFragment) {
    try {
      // Búsqueda difusa simple: coincidencia de usuario, status pending, y descripción parecida.
      // El monto puede variar un poco, pero por ahora lo buscamos cercano o ignoramos si la descripción es muy fuerte.
      // Aquí usaremos ILIKE para descripción y rango de monto del 10%.

      const result = await query(
        `SELECT * FROM transactions
         WHERE user_id = $1
         AND status = 'pending'
         AND is_deleted = false
         AND description ILIKE $2
         AND amount BETWEEN $3 * 0.9 AND $3 * 1.1
         LIMIT 1`,
        [userId, `%${descriptionFragment}%`, amount]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error buscando match de pendiente', error);
      return null;
    }
  }

  /**
   * Actualiza el estado y fecha de una transacción
   */
  async updateStatus(transactionId, status, newDate = null) {
    const dateVal = newDate || new Date();
    try {
      const result = await query(
        `UPDATE transactions 
               SET status = $2, transaction_date = $3, updated_at = NOW()
               WHERE transaction_id = $1
               RETURNING *`,
        [transactionId, status, dateVal]
      );
      return result.rows[0];
    } catch (error) {
      Logger.error('Error actualizando status transacción', error);
      throw error;
    }
  }
}

module.exports = new TransactionDBService();
