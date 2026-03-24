const pool = require('../../config/database');
const Logger = require('../../utils/logger');

/**
 * Servicio de base de datos para deudas
 */
class DebtDBService {
    /**
     * Crear una nueva deuda
     * @param {Object} debtData
     * @returns {Promise<Object>}
     */
    async create(debtData) {
        const {
            user_id,
            name,
            total_amount,
            remaining_amount = null,
            interest_rate = null,
            payment_day = null,
            minimum_payment = null,
            notes = null,
            creditor = null,
            debt_type = 'personal'
        } = debtData;

        try {
            const result = await pool.query(
                `INSERT INTO debts
                (user_id, name, total_amount, remaining_amount, interest_rate,
                 payment_day, minimum_payment, notes, creditor, debt_type, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
                RETURNING *`,
                [
                    user_id,
                    name,
                    total_amount,
                    remaining_amount || total_amount,
                    interest_rate,
                    payment_day,
                    minimum_payment,
                    notes,
                    creditor,
                    debt_type
                ]
            );

            Logger.success(`📋 Deuda creada: ${name} - $${total_amount}`);
            return result.rows[0];
        } catch (error) {
            Logger.error('Error creando deuda', error);
            throw error;
        }
    }

    /**
     * Obtener todas las deudas de un usuario
     * @param {string} userId
     * @param {string} status - 'active', 'paid', 'all'
     * @returns {Promise<Array>}
     */
    async getByUserId(userId, status = 'active') {
        try {
            let query = `SELECT * FROM debts WHERE user_id = $1`;
            const params = [userId];

            if (status !== 'all') {
                query += ` AND status = $2`;
                params.push(status);
            }

            query += ` ORDER BY created_at DESC`;

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            Logger.error('Error obteniendo deudas del usuario', error);
            throw error;
        }
    }

    /**
     * Obtener una deuda específica por ID
     * @param {string} debtId
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    async getById(debtId, userId) {
        try {
            const result = await pool.query(
                `SELECT * FROM debts
                WHERE debt_id = $1 AND user_id = $2`,
                [debtId, userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            Logger.error('Error obteniendo deuda por ID', error);
            throw error;
        }
    }

    /**
     * Buscar deuda por nombre (case-insensitive)
     * @param {string} name
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    async findByName(name, userId) {
        try {
            const result = await pool.query(
                `SELECT * FROM debts
                WHERE LOWER(name) = LOWER($1) AND user_id = $2 AND status = 'active'
                LIMIT 1`,
                [name, userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            Logger.error('Error buscando deuda por nombre', error);
            throw error;
        }
    }

    /**
     * Registrar un pago a una deuda
     * @param {string} debtId
     * @param {string} userId
     * @param {number} amount
     * @param {string} fromAccountId - ID de la cuenta desde donde se paga
     * @returns {Promise<Object>}
     */
    async recordPayment(debtId, userId, amount, fromAccountId = null) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Obtener deuda actual
            const debtResult = await client.query(
                `SELECT * FROM debts WHERE debt_id = $1 AND user_id = $2`,
                [debtId, userId]
            );

            if (debtResult.rows.length === 0) {
                throw new Error('Deuda no encontrada');
            }

            const debt = debtResult.rows[0];
            const newRemaining = parseFloat(debt.remaining_amount) - parseFloat(amount);
            const newTotalPaid = parseFloat(debt.total_paid || 0) + parseFloat(amount);

            // Validar que no se pague más de lo debido
            if (newRemaining < 0) {
                throw new Error('El monto del pago excede la deuda restante');
            }

            // Actualizar deuda
            const updatedDebt = await client.query(
                `UPDATE debts
                SET remaining_amount = $1,
                    total_paid = $2,
                    last_payment_date = NOW(),
                    status = CASE
                        WHEN $1 <= 0 THEN 'paid'
                        ELSE status
                    END,
                    paid_at = CASE
                        WHEN $1 <= 0 AND paid_at IS NULL THEN NOW()
                        ELSE paid_at
                    END
                WHERE debt_id = $3 AND user_id = $4
                RETURNING *`,
                [newRemaining, newTotalPaid, debtId, userId]
            );

            // Si se especificó cuenta de origen, crear transacción
            if (fromAccountId) {
                await client.query(
                    `INSERT INTO transactions
                    (user_id, account_id, type, amount, description, category_id, status)
                    VALUES ($1, $2, 'expense', $3, $4,
                        (SELECT category_id FROM categories WHERE name = 'Deudas' AND user_id = $1 LIMIT 1),
                        'completed')`,
                    [userId, fromAccountId, amount, `Pago de deuda: ${debt.name}`]
                );

                // Actualizar balance de la cuenta
                await client.query(
                    `UPDATE accounts SET balance = balance - $1 WHERE account_id = $2`,
                    [amount, fromAccountId]
                );
            }

            await client.query('COMMIT');

            Logger.success(`💸 Pago de deuda: ${debt.name} -$${amount}`);
            return updatedDebt.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            Logger.error('Error registrando pago de deuda', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Actualizar una deuda
     * @param {string} debtId
     * @param {string} userId
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async update(debtId, userId, updates) {
        try {
            const fields = [];
            const values = [];
            let paramCount = 1;

            const allowedFields = [
                'name', 'total_amount', 'remaining_amount', 'interest_rate',
                'payment_day', 'minimum_payment', 'notes', 'creditor', 'debt_type', 'status'
            ];

            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = $${paramCount}`);
                    values.push(updates[key]);
                    paramCount++;
                }
            });

            if (fields.length === 0) {
                throw new Error('No hay campos para actualizar');
            }

            values.push(debtId, userId);

            const result = await pool.query(
                `UPDATE debts
                SET ${fields.join(', ')}, updated_at = NOW()
                WHERE debt_id = $${paramCount} AND user_id = $${paramCount + 1}
                RETURNING *`,
                values
            );

            if (result.rows.length === 0) {
                throw new Error('Deuda no encontrada');
            }

            Logger.success(`✅ Deuda actualizada: ${result.rows[0].name}`);
            return result.rows[0];

        } catch (error) {
            Logger.error('Error actualizando deuda', error);
            throw error;
        }
    }

    /**
     * Eliminar una deuda
     * @param {string} debtId
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async delete(debtId, userId) {
        try {
            const result = await pool.query(
                `DELETE FROM debts
                WHERE debt_id = $1 AND user_id = $2
                RETURNING *`,
                [debtId, userId]
            );

            if (result.rows.length === 0) {
                throw new Error('Deuda no encontrada');
            }

            Logger.success(`🗑️ Deuda eliminada: ${result.rows[0].name}`);
            return true;

        } catch (error) {
            Logger.error('Error eliminando deuda', error);
            throw error;
        }
    }

    /**
     * Obtener resumen de deudas de un usuario
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getSummary(userId) {
        try {
            const result = await pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE status = 'active') as active_count,
                    COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
                    COALESCE(SUM(remaining_amount) FILTER (WHERE status = 'active'), 0) as total_remaining,
                    COALESCE(SUM(total_paid), 0) as total_paid_overall,
                    COALESCE(SUM(minimum_payment) FILTER (WHERE status = 'active'), 0) as monthly_minimum
                FROM debts
                WHERE user_id = $1`,
                [userId]
            );

            return result.rows[0];
        } catch (error) {
            Logger.error('Error obteniendo resumen de deudas', error);
            throw error;
        }
    }
}

module.exports = new DebtDBService();
