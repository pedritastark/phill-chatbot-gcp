const { query } = require('../../config/database');
const Logger = require('../../utils/logger');

/**
 * Servicio de base de datos para la tabla categories
 */
class CategoryDBService {
  /**
   * Obtiene todas las categorías de un usuario
   * @param {string} userId - UUID del usuario
   * @param {string} type - Tipo: 'income', 'expense' o null para todas
   * @returns {Promise<Array>} - Lista de categorías
   */
  async findByUser(userId, type = null) {
    try {
      let queryText = `
        SELECT * FROM categories 
        WHERE user_id = $1 AND is_active = true
      `;
      
      const params = [userId];

      if (type) {
        queryText += ` AND type = $2`;
        params.push(type);
      }

      queryText += ` ORDER BY name ASC`;

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      Logger.error('Error al obtener categorías', error);
      throw error;
    }
  }

  /**
   * Busca una categoría por su ID
   * @param {string} categoryId - UUID de la categoría
   * @returns {Promise<Object|null>} - Categoría o null
   */
  async findById(categoryId) {
    try {
      const result = await query(
        `SELECT * FROM categories WHERE category_id = $1 AND is_active = true`,
        [categoryId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error al buscar categoría', error);
      throw error;
    }
  }

  /**
   * Busca una categoría por nombre
   * @param {string} userId - UUID del usuario
   * @param {string} name - Nombre de la categoría
   * @param {string} type - Tipo: 'income' o 'expense'
   * @returns {Promise<Object|null>} - Categoría o null
   */
  async findByName(userId, name, type) {
    try {
      const result = await query(
        `SELECT * FROM categories 
         WHERE user_id = $1 AND name ILIKE $2 AND type = $3 AND is_active = true`,
        [userId, name, type]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error al buscar categoría por nombre', error);
      throw error;
    }
  }

  /**
   * Crea una nueva categoría
   * @param {Object} categoryData - Datos de la categoría
   * @returns {Promise<Object>} - Categoría creada
   */
  async create(categoryData) {
    try {
      const {
        userId,
        name,
        type,
        description,
        color,
        icon,
        parentCategoryId,
      } = categoryData;

      const result = await query(
        `INSERT INTO categories (
          user_id,
          name,
          type,
          description,
          color,
          icon,
          parent_category_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          userId,
          name,
          type,
          description || null,
          color || '#6366f1',
          icon || 'tag',
          parentCategoryId || null,
        ]
      );

      Logger.success(`✅ Categoría creada: ${name} (${type})`);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        Logger.warning(`La categoría "${categoryData.name}" ya existe`);
        return await this.findByName(categoryData.userId, categoryData.name, categoryData.type);
      }
      Logger.error('Error al crear categoría', error);
      throw error;
    }
  }

  /**
   * Actualiza una categoría
   * @param {string} categoryId - UUID de la categoría
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} - Categoría actualizada
   */
  async update(categoryId, updateData) {
    try {
      const { name, description, color, icon } = updateData;

      const result = await query(
        `UPDATE categories SET
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          color = COALESCE($4, color),
          icon = COALESCE($5, icon),
          updated_at = CURRENT_TIMESTAMP
         WHERE category_id = $1 AND is_active = true
         RETURNING *`,
        [categoryId, name, description, color, icon]
      );

      if (result.rows.length === 0) {
        throw new Error('Categoría no encontrada');
      }

      Logger.success(`✅ Categoría actualizada: ${categoryId}`);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error al actualizar categoría', error);
      throw error;
    }
  }

  /**
   * Desactiva una categoría (soft delete)
   * @param {string} categoryId - UUID de la categoría
   */
  async delete(categoryId) {
    try {
      await query(
        `UPDATE categories 
         SET is_active = false, updated_at = CURRENT_TIMESTAMP 
         WHERE category_id = $1`,
        [categoryId]
      );

      Logger.info(`Categoría desactivada: ${categoryId}`);
    } catch (error) {
      Logger.error('Error al desactivar categoría', error);
      throw error;
    }
  }

  /**
   * Obtiene categorías con estadísticas de uso
   * @param {string} userId - UUID del usuario
   * @param {string} period - Periodo: 'month', 'year', 'all'
   * @returns {Promise<Array>} - Categorías con estadísticas
   */
  async getWithStats(userId, period = 'month') {
    try {
      let dateFilter = '';
      
      switch (period) {
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
          c.*,
          COUNT(t.transaction_id) as transaction_count,
          COALESCE(SUM(t.amount), 0) as total_amount,
          COALESCE(AVG(t.amount), 0) as avg_amount
         FROM categories c
         LEFT JOIN transactions t ON c.category_id = t.category_id 
           AND t.is_deleted = false ${dateFilter}
         WHERE c.user_id = $1 AND c.is_active = true
         GROUP BY c.category_id
         ORDER BY total_amount DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error al obtener categorías con estadísticas', error);
      throw error;
    }
  }

  /**
   * Busca o crea una categoría por nombre (útil para detección automática)
   * @param {string} userId - UUID del usuario
   * @param {string} name - Nombre de la categoría
   * @param {string} type - Tipo: 'income' o 'expense'
   * @returns {Promise<Object>} - Categoría encontrada o creada
   */
  async findOrCreate(userId, name, type) {
    try {
      let category = await this.findByName(userId, name, type);
      
      if (!category) {
        category = await this.create({
          userId,
          name,
          type,
          color: type === 'income' ? '#10b981' : '#ef4444',
          icon: type === 'income' ? '💰' : '💸',
        });
      }

      return category;
    } catch (error) {
      Logger.error('Error al buscar o crear categoría', error);
      throw error;
    }
  }
}

module.exports = new CategoryDBService();

