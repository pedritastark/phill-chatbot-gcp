const { query } = require('../../config/database');
const Logger = require('../../utils/logger');

/**
 * Servicio de base de datos para la tabla accounts
 */
class AccountDBService {
  /**
   * Obtiene todas las cuentas de un usuario
   * @param {string} userId - UUID del usuario
   * @returns {Promise<Array>} - Lista de cuentas
   */
  async findByUser(userId) {
    try {
      const result = await query(
        `SELECT * FROM accounts 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY is_default DESC, name ASC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error al obtener cuentas', error);
      throw error;
    }
  }

  /**
   * Busca una cuenta por su ID
   * @param {string} accountId - UUID de la cuenta
   * @returns {Promise<Object|null>} - Cuenta o null
   */
  async findById(accountId) {
    try {
      const result = await query(
        `SELECT * FROM accounts WHERE account_id = $1 AND is_active = true`,
        [accountId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error al buscar cuenta', error);
      throw error;
    }
  }

  /**
   * Obtiene la cuenta predeterminada de un usuario
   * @param {string} userId - UUID del usuario
   * @returns {Promise<Object|null>} - Cuenta predeterminada o null
   */
  async getDefaultAccount(userId) {
    try {
      const result = await query(
        `SELECT * FROM accounts 
         WHERE user_id = $1 AND is_default = true AND is_active = true 
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Si no hay cuenta predeterminada, buscar la primera creada
      const fallback = await query(
        `SELECT * FROM accounts 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY created_at ASC 
         LIMIT 1`,
        [userId]
      );

      if (fallback.rows.length > 0) {
        return fallback.rows[0];
      }

      // Si no existe NINGUNA cuenta, crear la cuenta por defecto "Efectivo"
      Logger.info(`Usuario ${userId} no tiene cuentas. Creando 'Efectivo' por defecto.`);
      const newAccount = await this.create({
        userId,
        name: 'Efectivo',
        type: 'cash',
        balance: 0,
        isDefault: true,
        icon: 'money'
      });

      return newAccount;
    } catch (error) {
      Logger.error('Error al obtener cuenta predeterminada', error);
      throw error;
    }
  }

  /**
   * Crea una nueva cuenta
   * @param {Object} accountData - Datos de la cuenta
   * @returns {Promise<Object>} - Cuenta creada
   */
  async create(accountData) {
    try {
      const {
        userId,
        name,
        type,
        bankName,
        balance,
        creditLimit,
        interestRate,
        accountNumberLast4,
        color,
        icon,
        isDefault,
      } = accountData;

      const result = await query(
        `INSERT INTO accounts (
          user_id,
          name,
          type,
          bank_name,
          balance,
          credit_limit,
          interest_rate,
          account_number_last4,
          color,
          icon,
          is_default,
          category,
          currency
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          userId,
          name,
          type,
          bankName || null,
          balance || 0,
          creditLimit || null,
          interestRate || null,
          accountNumberLast4 || null,
          color || '#6366f1',
          icon || 'bank',
          isDefault || false,
          accountData.category || 'LIQUIDEZ',
          accountData.currency || 'COP'
        ]
      );

      Logger.success(`✅ Cuenta creada: ${name} (${type})`);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error al crear cuenta', error);
      throw error;
    }
  }

  /**
   * Actualiza una cuenta
   * @param {string} accountId - UUID de la cuenta
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} - Cuenta actualizada
   */
  async update(accountId, updateData) {
    try {
      const {
        name,
        bankName,
        balance,
        creditLimit,
        interestRate,
        accountNumberLast4,
        color,
        icon,
        isDefault,
      } = updateData;

      const result = await query(
        `UPDATE accounts SET
          name = COALESCE($2, name),
          bank_name = COALESCE($3, bank_name),
          balance = COALESCE($4, balance),
          credit_limit = COALESCE($5, credit_limit),
          interest_rate = COALESCE($6, interest_rate),
          account_number_last4 = COALESCE($7, account_number_last4),
          color = COALESCE($8, color),
          icon = COALESCE($9, icon),
          is_default = COALESCE($10, is_default),
          category = COALESCE($11, category),
          updated_at = CURRENT_TIMESTAMP
         WHERE account_id = $1 AND is_active = true
         RETURNING *`,
        [
          accountId,
          name,
          bankName,
          balance,
          creditLimit,
          interestRate,
          accountNumberLast4,
          color,
          icon,
          isDefault,
          updateData.category
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Cuenta no encontrada');
      }

      Logger.success(`✅ Cuenta actualizada: ${accountId}`);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error al actualizar cuenta', error);
      throw error;
    }
  }

  /**
   * Actualiza el balance de una cuenta
   * @param {string} accountId - UUID de la cuenta
   * @param {number} amount - Monto a sumar/restar
   * @param {string} operation - 'add' o 'subtract'
   */
  async updateBalance(accountId, amount, operation = 'add') {
    try {
      const operator = operation === 'add' ? '+' : '-';

      await query(
        `UPDATE accounts 
         SET balance = balance ${operator} $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE account_id = $1`,
        [accountId, Math.abs(amount)]
      );

      Logger.info(`Balance actualizado para cuenta: ${accountId}`);
    } catch (error) {
      Logger.error('Error al actualizar balance', error);
      throw error;
    }
  }

  /**
   * Desactiva una cuenta (soft delete)
   * @param {string} accountId - UUID de la cuenta
   */
  async delete(accountId) {
    try {
      await query(
        `UPDATE accounts 
         SET is_active = false, updated_at = CURRENT_TIMESTAMP 
         WHERE account_id = $1`,
        [accountId]
      );

      Logger.info(`Cuenta desactivada: ${accountId}`);
    } catch (error) {
      Logger.error('Error al desactivar cuenta', error);
      throw error;
    }
  }

  /**
   * Establece una cuenta como predeterminada
   * @param {string} accountId - UUID de la cuenta
   * @param {string} userId - UUID del usuario
   */
  async setAsDefault(accountId, userId) {
    try {
      // Primero, quitar el flag de default de todas las cuentas del usuario
      await query(
        `UPDATE accounts 
         SET is_default = false 
         WHERE user_id = $1`,
        [userId]
      );

      // Luego, establecer la cuenta especificada como default
      await query(
        `UPDATE accounts 
         SET is_default = true, updated_at = CURRENT_TIMESTAMP 
         WHERE account_id = $1`,
        [accountId]
      );

      Logger.success(`✅ Cuenta establecida como predeterminada: ${accountId}`);
    } catch (error) {
      Logger.error('Error al establecer cuenta predeterminada', error);
      throw error;
    }
  }

  /**
   * Obtiene el balance total de todas las cuentas de un usuario
   * @param {string} userId - UUID del usuario
   * @returns {Promise<number>} - Balance total
   */
  async getTotalBalance(userId) {
    try {
      const result = await query(
        `SELECT COALESCE(SUM(balance), 0) as total_balance
         FROM accounts
         WHERE user_id = $1 AND is_active = true AND type != 'credit_card'`,
        [userId]
      );

      return parseFloat(result.rows[0].total_balance);
    } catch (error) {
      Logger.error('Error al obtener balance total', error);
      throw error;
    }
  }

  /**
   * Obtiene cuentas con estadísticas de transacciones
   * @param {string} userId - UUID del usuario
   * @returns {Promise<Array>} - Cuentas con estadísticas
   */
  async getWithStats(userId) {
    try {
      const result = await query(
        `SELECT 
          a.*,
          COUNT(t.transaction_id) as transaction_count,
          COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense
         FROM accounts a
         LEFT JOIN transactions t ON a.account_id = t.account_id 
           AND t.is_deleted = false
         WHERE a.user_id = $1 AND a.is_active = true
         GROUP BY a.account_id
         ORDER BY a.is_default DESC, a.name ASC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      Logger.error('Error al obtener cuentas con estadísticas', error);
      throw error;
    }
  }

  /**
   * Obtiene los detalles de una tarjeta de crédito (cupo, usado, disponible)
   * @param {string} accountId - UUID de la cuenta
   * @returns {Promise<{available: number, limit: number, used: number}|null>}
   */
  async getCreditCardDetails(accountId) {
    try {
      const account = await this.findById(accountId);
      if (!account || account.type !== 'credit_card') {
        return null;
      }

      const limit = parseFloat(account.credit_limit) || 0;
      const used = parseFloat(account.balance) || 0;
      const available = limit - used;

      return {
        available,
        limit,
        used,
        name: account.name
      };
    } catch (error) {
      Logger.error('Error al obtener detalles de tarjeta de crédito', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las tarjetas de crédito de un usuario con sus detalles
   * @param {string} userId - UUID del usuario
   * @returns {Promise<Array<{available: number, limit: number, used: number, name: string}>>}
   */
  async getCreditCardsByUser(userId) {
    try {
      const result = await query(
        `SELECT * FROM accounts 
         WHERE user_id = $1 AND type = 'credit_card' AND is_active = true`,
        [userId]
      );

      return result.rows.map(account => ({
        account_id: account.account_id,
        name: account.name,
        limit: parseFloat(account.credit_limit) || 0,
        used: parseFloat(account.balance) || 0,
        available: (parseFloat(account.credit_limit) || 0) - (parseFloat(account.balance) || 0)
      }));
    } catch (error) {
      Logger.error('Error al obtener tarjetas de crédito del usuario', error);
      throw error;
    }
  }
}

module.exports = new AccountDBService();

