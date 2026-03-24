const pool = require('../../config/database');
const Logger = require('../../utils/logger');

/**
 * Servicio de base de datos para metas de ahorro
 */
class GoalDBService {
    /**
     * Crear una nueva meta de ahorro
     * @param {Object} goalData
     * @returns {Promise<Object>}
     */
    async create(goalData) {
        const {
            user_id,
            name,
            description = null,
            target_amount,
            current_amount = 0,
            target_date = null,
            category = 'general',
            priority = 'medium',
            icon = null
        } = goalData;

        try {
            const result = await pool.query(
                `INSERT INTO financial_goals
                (user_id, name, description, target_amount, current_amount, target_date, category, priority, icon, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
                RETURNING *`,
                [user_id, name, description, target_amount, current_amount, target_date, category, priority, icon]
            );

            Logger.success(`✅ Meta creada: ${name} - $${target_amount}`);
            return result.rows[0];
        } catch (error) {
            Logger.error('Error creando meta de ahorro', error);
            throw error;
        }
    }

    /**
     * Obtener todas las metas de un usuario
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async getByUserId(userId) {
        try {
            const result = await pool.query(
                `SELECT * FROM financial_goals
                WHERE user_id = $1
                ORDER BY created_at DESC`,
                [userId]
            );
            return result.rows;
        } catch (error) {
            Logger.error('Error obteniendo metas del usuario', error);
            throw error;
        }
    }

    /**
     * Obtener una meta específica por ID
     * @param {string} goalId
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    async getById(goalId, userId) {
        try {
            const result = await pool.query(
                `SELECT * FROM financial_goals
                WHERE goal_id = $1 AND user_id = $2`,
                [goalId, userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            Logger.error('Error obteniendo meta por ID', error);
            throw error;
        }
    }

    /**
     * Buscar meta por nombre (case-insensitive)
     * @param {string} name
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    async findByName(name, userId) {
        try {
            const result = await pool.query(
                `SELECT * FROM financial_goals
                WHERE LOWER(name) = LOWER($1) AND user_id = $2 AND status = 'active'
                LIMIT 1`,
                [name, userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            Logger.error('Error buscando meta por nombre', error);
            throw error;
        }
    }

    /**
     * Depositar dinero a una meta
     * @param {string} goalId
     * @param {string} userId
     * @param {number} amount
     * @param {string} fromAccountId - ID de la cuenta de origen
     * @returns {Promise<Object>}
     */
    async deposit(goalId, userId, amount, fromAccountId = null) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Obtener meta actual
            const goalResult = await client.query(
                `SELECT * FROM financial_goals WHERE goal_id = $1 AND user_id = $2`,
                [goalId, userId]
            );

            if (goalResult.rows.length === 0) {
                throw new Error('Meta no encontrada');
            }

            const goal = goalResult.rows[0];
            const newAmount = parseFloat(goal.current_amount) + parseFloat(amount);

            // Actualizar meta
            const updatedGoal = await client.query(
                `UPDATE financial_goals
                SET current_amount = $1,
                    last_deposit_at = NOW(),
                    status = CASE
                        WHEN $1 >= target_amount THEN 'completed'
                        ELSE status
                    END,
                    completed_at = CASE
                        WHEN $1 >= target_amount AND completed_at IS NULL THEN NOW()
                        ELSE completed_at
                    END
                WHERE goal_id = $2 AND user_id = $3
                RETURNING *`,
                [newAmount, goalId, userId]
            );

            // Si se especificó cuenta de origen, crear transacción de gasto
            if (fromAccountId) {
                await client.query(
                    `INSERT INTO transactions
                    (user_id, account_id, type, amount, description, category_id, status)
                    VALUES ($1, $2, 'expense', $3, $4,
                        (SELECT category_id FROM categories WHERE name = 'Ahorro' AND user_id = $1 LIMIT 1),
                        'completed')`,
                    [userId, fromAccountId, amount, `Depósito a meta: ${goal.name}`]
                );

                // Actualizar balance de la cuenta
                await client.query(
                    `UPDATE accounts SET balance = balance - $1 WHERE account_id = $2`,
                    [amount, fromAccountId]
                );
            }

            await client.query('COMMIT');

            Logger.success(`💰 Depósito a meta: ${goal.name} +$${amount}`);
            return updatedGoal.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            Logger.error('Error depositando a meta', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Actualizar una meta
     * @param {string} goalId
     * @param {string} userId
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async update(goalId, userId, updates) {
        try {
            const fields = [];
            const values = [];
            let paramCount = 1;

            Object.keys(updates).forEach(key => {
                if (['name', 'description', 'target_amount', 'target_date', 'category', 'priority', 'icon', 'status'].includes(key)) {
                    fields.push(`${key} = $${paramCount}`);
                    values.push(updates[key]);
                    paramCount++;
                }
            });

            if (fields.length === 0) {
                throw new Error('No hay campos para actualizar');
            }

            values.push(goalId, userId);

            const result = await pool.query(
                `UPDATE financial_goals
                SET ${fields.join(', ')}, updated_at = NOW()
                WHERE goal_id = $${paramCount} AND user_id = $${paramCount + 1}
                RETURNING *`,
                values
            );

            if (result.rows.length === 0) {
                throw new Error('Meta no encontrada');
            }

            Logger.success(`✅ Meta actualizada: ${result.rows[0].name}`);
            return result.rows[0];

        } catch (error) {
            Logger.error('Error actualizando meta', error);
            throw error;
        }
    }

    /**
     * Eliminar una meta
     * @param {string} goalId
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async delete(goalId, userId) {
        try {
            const result = await pool.query(
                `DELETE FROM financial_goals
                WHERE goal_id = $1 AND user_id = $2
                RETURNING *`,
                [goalId, userId]
            );

            if (result.rows.length === 0) {
                throw new Error('Meta no encontrada');
            }

            Logger.success(`🗑️ Meta eliminada: ${result.rows[0].name}`);
            return true;

        } catch (error) {
            Logger.error('Error eliminando meta', error);
            throw error;
        }
    }
}

module.exports = new GoalDBService();
