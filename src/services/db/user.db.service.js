const { query, transaction } = require('../../config/database');
const Logger = require('../../utils/logger');

/**
 * Servicio de base de datos para la tabla users
 */
class UserDBService {
  /**
   * Busca un usuario por su número de teléfono
   * @param {string} phoneNumber - Número de teléfono (formato: whatsapp:+573218372110)
   * @returns {Promise<Object|null>} - Usuario o null si no existe
   */
  async findByPhoneNumber(phoneNumber) {
    try {
      const result = await query(
        `SELECT * FROM users WHERE phone_number = $1 AND is_active = true`,
        [phoneNumber]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error(`Error al buscar usuario por teléfono: ${phoneNumber}`, error);
      throw error;
    }
  }

  /**
   * Busca un usuario por su ID
   * @param {string} userId - UUID del usuario
   * @returns {Promise<Object|null>} - Usuario o null si no existe
   */
  async findById(userId) {
    try {
      const result = await query(
        `SELECT * FROM users WHERE user_id = $1 AND is_active = true`,
        [userId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error(`Error al buscar usuario por ID: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Crea un nuevo usuario o lo retorna si ya existe
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} - Usuario creado o existente
   */
  async findOrCreate(userData) {
    try {
      const { phoneNumber, name } = userData;

      // Primero intentar encontrar el usuario
      let user = await this.findByPhoneNumber(phoneNumber);

      if (user) {
        // Actualizar last_interaction
        await this.updateLastInteraction(user.user_id);
        return user;
      }

      // Si no existe, crearlo
      const result = await query(
        `INSERT INTO users (
          phone_number, 
          name, 
          language, 
          currency,
          timezone,
          created_at,
          updated_at,
          last_interaction
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [phoneNumber, name || null, 'es', 'COP', 'America/Bogota']
      );

      user = result.rows[0];
      Logger.success(`✅ Nuevo usuario creado: ${phoneNumber}`);

      // Crear categorías predeterminadas para el nuevo usuario
      await this.createDefaultCategories(user.user_id);

      // Crear cuenta de efectivo predeterminada
      await this.createDefaultAccount(user.user_id);

      return user;
    } catch (error) {
      Logger.error('Error al crear o encontrar usuario', error);
      throw error;
    }
  }

  /**
   * Actualiza la última interacción del usuario
   * @param {string} userId - UUID del usuario
   */
  async updateLastInteraction(userId) {
    try {
      await query(
        `UPDATE users 
         SET last_interaction = CURRENT_TIMESTAMP,
             total_messages = total_messages + 1
         WHERE user_id = $1`,
        [userId]
      );
    } catch (error) {
      Logger.error('Error al actualizar última interacción', error);
    }
  }

  /**
   * Actualiza campos genéricos de un usuario
   * @param {string} phoneNumber - Teléfono del usuario
   * @param {Object} updateData - Datos a actualizar
   */
  async updateUser(phoneNumber, updateData) {
    try {
      const keys = Object.keys(updateData);
      if (keys.length === 0) return;

      const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [phoneNumber, ...Object.values(updateData)];

      await query(
        `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE phone_number = $1`,
        values
      );

      Logger.info(`Usuario actualizado: ${phoneNumber} (${keys.join(', ')})`);
    } catch (error) {
      Logger.error('Error al actualizar usuario', error);
      throw error;
    }
  }

  /**
   * Actualiza el perfil de un usuario
   * @param {string} userId - UUID del usuario
   * @param {Object} profileData - Datos del perfil a actualizar
   * @returns {Promise<Object>} - Usuario actualizado
   */
  async updateProfile(userId, profileData) {
    try {
      const {
        name,
        email,
        monthlyIncome,
        savingsGoal,
        financialLiteracy,
        primaryGoal,
        riskTolerance,
        language,
        currency,
        timezone,
      } = profileData;

      const result = await query(
        `UPDATE users SET
          name = COALESCE($2, name),
          email = COALESCE($3, email),
          monthly_income = COALESCE($4, monthly_income),
          savings_goal = COALESCE($5, savings_goal),
          financial_literacy = COALESCE($6, financial_literacy),
          primary_goal = COALESCE($7, primary_goal),
          risk_tolerance = COALESCE($8, risk_tolerance),
          language = COALESCE($9, language),
          currency = COALESCE($10, currency),
          timezone = COALESCE($11, timezone),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *`,
        [
          userId,
          name,
          email,
          monthlyIncome,
          savingsGoal,
          financialLiteracy,
          primaryGoal,
          riskTolerance,
          language,
          currency,
          timezone,
        ]
      );

      Logger.success(`✅ Perfil actualizado para usuario: ${userId}`);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error al actualizar perfil de usuario', error);
      throw error;
    }
  }

  /**
   * Obtiene el resumen financiero de un usuario
   * @param {string} userId - UUID del usuario
   * @returns {Promise<Object>} - Resumen financiero
   */
  async getFinancialSummary(userId) {
    try {
      const result = await query(
        `SELECT * FROM user_financial_summary WHERE user_id = $1`,
        [userId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error al obtener resumen financiero', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los usuarios activos
   * @param {number} limit - Límite de resultados
   * @param {number} offset - Offset para paginación
   * @returns {Promise<Array>} - Lista de usuarios
   */
  async getAllUsers(limit = 50, offset = 0) {
    try {
      const result = await query(
        `SELECT * FROM users 
         WHERE is_active = true 
         ORDER BY last_interaction DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error al obtener usuarios', error);
      throw error;
    }
  }

  /**
   * Desactiva un usuario (soft delete)
   * @param {string} userId - UUID del usuario
   */
  async deactivateUser(userId) {
    try {
      await query(
        `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [userId]
      );

      Logger.info(`Usuario desactivado: ${userId}`);
    } catch (error) {
      Logger.error('Error al desactivar usuario', error);
      throw error;
    }
  }

  /**
   * Crea categorías predeterminadas para un nuevo usuario
   * @param {string} userId - UUID del usuario
   */
  async createDefaultCategories(userId) {
    try {
      const defaultCategories = [
        // Gastos
        { name: 'Alimentación', type: 'expense', icon: '🍔', color: '#ef4444' },
        { name: 'Transporte', type: 'expense', icon: '🚗', color: '#f59e0b' },
        { name: 'Vivienda', type: 'expense', icon: '🏠', color: '#8b5cf6' },
        { name: 'Salud', type: 'expense', icon: '🏥', color: '#10b981' },
        { name: 'Educación', type: 'expense', icon: '📚', color: '#3b82f6' },
        { name: 'Entretenimiento', type: 'expense', icon: '🎬', color: '#ec4899' },
        { name: 'Servicios', type: 'expense', icon: '💡', color: '#6366f1' },
        { name: 'Compras', type: 'expense', icon: '🛍️', color: '#f43f5e' },
        { name: 'Otros Gastos', type: 'expense', icon: '💸', color: '#64748b' },

        // Ingresos
        { name: 'Salario', type: 'income', icon: '💰', color: '#10b981' },
        { name: 'Freelance', type: 'income', icon: '💼', color: '#3b82f6' },
        { name: 'Inversiones', type: 'income', icon: '📈', color: '#8b5cf6' },
        { name: 'Bonos', type: 'income', icon: '🎁', color: '#f59e0b' },
        { name: 'Otros Ingresos', type: 'income', icon: '💵', color: '#14b8a6' },
      ];

      for (const category of defaultCategories) {
        await query(
          `INSERT INTO categories (user_id, name, type, icon, color)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, name, type) DO NOTHING`,
          [userId, category.name, category.type, category.icon, category.color]
        );
      }

      Logger.success(`✅ Categorías predeterminadas creadas para usuario: ${userId}`);
    } catch (error) {
      Logger.error('Error al crear categorías predeterminadas', error);
      // No lanzamos el error para no interrumpir la creación del usuario
    }
  }

  /**
   * Crea una cuenta de efectivo predeterminada para un nuevo usuario
   * @param {string} userId - UUID del usuario
   */
  async createDefaultAccount(userId) {
    try {
      await query(
        `INSERT INTO accounts (user_id, name, type, balance, is_default, icon, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, 'Efectivo', 'cash', 0, true, '💵', '#10b981']
      );

      Logger.success(`✅ Cuenta predeterminada creada para usuario: ${userId}`);
    } catch (error) {
      Logger.error('Error al crear cuenta predeterminada', error);
      // No lanzamos el error para no interrumpir la creación del usuario
    }
  }

  /**
   * Obtiene estadísticas generales del sistema
   * @returns {Promise<Object>} - Estadísticas
   */
  async getSystemStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE created_at > CURRENT_DATE - INTERVAL '7 days') as new_users_week,
          COUNT(*) FILTER (WHERE last_interaction > CURRENT_DATE - INTERVAL '7 days') as active_users_week,
          COUNT(*) FILTER (WHERE last_interaction > CURRENT_DATE - INTERVAL '30 days') as active_users_month
        FROM users
        WHERE is_active = true
      `);

      return result.rows[0];
    } catch (error) {
      Logger.error('Error al obtener estadísticas del sistema', error);
      throw error;
    }
  }
}

module.exports = new UserDBService();

