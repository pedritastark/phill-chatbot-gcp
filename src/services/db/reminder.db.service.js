const { query } = require('../../config/database');
const Logger = require('../../utils/logger');

const UPDATE_ALLOWED_FIELDS = [
  'message',
  'scheduled_at',
  'is_recurring',
  'recurrence_pattern',
  'status',
  'sent_at',
  'amount',
  'currency',
  'account_name',
  'account_id',
  'transaction_type',
  'completion_status',
  'completed_at',
  'linked_transaction_id'
];

class ReminderDBService {
  /**
   * Crea un nuevo recordatorio
   * @param {Object} reminderData
   * @returns {Promise<Object>}
   */
  async createReminder(reminderData) {
    const {
      userId,
      message,
      scheduledAt,
      isRecurring = false,
      recurrencePattern = null,
      amount = 0,
      currency = 'COP',
      accountName = null,
      accountId = null,
      transactionType = 'expense',
      completionStatus = 'pending',
      status = 'pending'
    } = reminderData;

    const text = `
      INSERT INTO reminders (
        user_id,
        message,
        scheduled_at,
        is_recurring,
        recurrence_pattern,
        amount,
        currency,
        account_name,
        account_id,
        transaction_type,
        completion_status,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      userId,
      message,
      scheduledAt,
      isRecurring,
      recurrencePattern,
      amount,
      currency,
      accountName,
      accountId,
      transactionType,
      completionStatus,
      status
    ];

    try {
      const result = await query(text, values);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error al crear recordatorio', error);
      throw error;
    }
  }

  /**
   * Obtiene recordatorios pendientes que deben enviarse ahora
   * @returns {Promise<Array>}
   */
  async getDueReminders() {
    const text = `
      SELECT r.*, u.phone_number, u.name
      FROM reminders r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.status = 'pending'
        AND r.completion_status = 'pending'
        AND r.scheduled_at <= NOW()
      ORDER BY r.scheduled_at ASC
    `;

    try {
      const result = await query(text);
      return result.rows;
    } catch (error) {
      Logger.error('Error al obtener recordatorios pendientes', error);
      throw error;
    }
  }

  /**
   * Obtiene los recordatorios activos de un usuario
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getByUser(userId) {
    const text = `
      SELECT *
      FROM reminders
      WHERE user_id = $1
      ORDER BY scheduled_at DESC
    `;

    try {
      const result = await query(text, [userId]);
      return result.rows;
    } catch (error) {
      Logger.error('Error al obtener recordatorios del usuario', error);
      throw error;
    }
  }

  /**
   * Obtiene un recordatorio por su ID
   * @param {string} reminderId
   * @returns {Promise<Object|null>}
   */
  async getById(reminderId) {
    const text = `
      SELECT *
      FROM reminders
      WHERE reminder_id = $1
      LIMIT 1
    `;

    try {
      const result = await query(text, [reminderId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error(`Error al obtener reminder ${reminderId}`, error);
      throw error;
    }
  }

  /**
   * Actualiza campos de un recordatorio
   * @param {string} reminderId
   * @param {Object} fields
   * @returns {Promise<Object>}
   */
  async updateReminder(reminderId, fields) {
    const entries = Object.entries(fields).filter(([key]) =>
      UPDATE_ALLOWED_FIELDS.includes(key)
    );

    if (entries.length === 0) {
      return this.getById(reminderId);
    }

    const setClauses = entries.map(
      ([key], index) => `${key} = $${index + 1}`
    );

    const values = entries.map(([, value]) => value);
    values.push(reminderId);

    const text = `
      UPDATE reminders
      SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE reminder_id = $${values.length}
      RETURNING *
    `;

    try {
      const result = await query(text, values);
      return result.rows[0];
    } catch (error) {
      Logger.error(`Error al actualizar reminder ${reminderId}`, error);
      throw error;
    }
  }

  /**
   * Marca un recordatorio como enviado
   * @param {string} reminderId
   * @returns {Promise<Object>}
   */
  async markAsSent(reminderId) {
    const text = `
      UPDATE reminders
      SET status = 'sent', sent_at = NOW(), updated_at = NOW()
      WHERE reminder_id = $1
      RETURNING *
    `;

    try {
      const result = await query(text, [reminderId]);
      return result.rows[0];
    } catch (error) {
      Logger.error(`Error al marcar recordatorio ${reminderId} como enviado`, error);
      throw error;
    }
  }

  /**
   * Marca un recordatorio como fallido
   * @param {string} reminderId
   * @returns {Promise<Object>}
   */
  async markAsFailed(reminderId) {
    const text = `
      UPDATE reminders
      SET status = 'failed', updated_at = NOW()
      WHERE reminder_id = $1
      RETURNING *
    `;

    try {
      const result = await query(text, [reminderId]);
      return result.rows[0];
    } catch (error) {
      Logger.error(`Error al marcar recordatorio ${reminderId} como fallido`, error);
      throw error;
    }
  }
}

module.exports = new ReminderDBService();
