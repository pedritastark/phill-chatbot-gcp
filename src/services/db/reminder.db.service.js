const { query } = require('../../config/database');
const Logger = require('../../utils/logger');

class ReminderDBService {
    /**
     * Crea un nuevo recordatorio
     * @param {Object} reminderData
     * @returns {Promise<Object>}
     */
    async createReminder(reminderData) {
        const { userId, message, scheduledAt, isRecurring = false, recurrencePattern = null } = reminderData;

        const text = `
      INSERT INTO reminders (user_id, message, scheduled_at, is_recurring, recurrence_pattern)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
        const values = [userId, message, scheduledAt, isRecurring, recurrencePattern];

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
