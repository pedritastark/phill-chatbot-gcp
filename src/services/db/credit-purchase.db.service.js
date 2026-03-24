const pool = require('../../config/database');
const Logger = require('../../utils/logger');

/**
 * Servicio de base de datos para compras a crédito (cuotas)
 */
class CreditPurchaseDBService {
    /**
     * Crear una nueva compra a crédito
     * @param {Object} purchaseData
     * @returns {Promise<Object>}
     */
    async create(purchaseData) {
        const {
            user_id,
            account_id,
            description,
            total_amount,
            installments,
            interest_rate = 0,
            notes = null
        } = purchaseData;

        try {
            // Calcular monto de cada cuota
            const installmentAmount = (parseFloat(total_amount) * (1 + parseFloat(interest_rate) / 100)) / parseInt(installments);

            const result = await pool.query(
                `INSERT INTO credit_purchases
                (user_id, account_id, description, total_amount, installment_amount,
                 installments, installments_paid, interest_rate, notes, status)
                VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, 'active')
                RETURNING *`,
                [
                    user_id,
                    account_id,
                    description,
                    total_amount,
                    installmentAmount,
                    installments,
                    interest_rate,
                    notes
                ]
            );

            Logger.success(`🛒 Compra a crédito creada: ${description} - $${total_amount} en ${installments} cuotas`);
            return result.rows[0];
        } catch (error) {
            Logger.error('Error creando compra a crédito', error);
            throw error;
        }
    }

    /**
     * Obtener todas las compras a crédito de un usuario
     * @param {string} userId
     * @param {string} status - 'active', 'paid', 'all'
     * @returns {Promise<Array>}
     */
    async getByUserId(userId, status = 'active') {
        try {
            let query = `
                SELECT cp.*, a.name as account_name
                FROM credit_purchases cp
                LEFT JOIN accounts a ON cp.account_id = a.account_id
                WHERE cp.user_id = $1
            `;
            const params = [userId];

            if (status !== 'all') {
                query += ` AND cp.status = $2`;
                params.push(status);
            }

            query += ` ORDER BY cp.created_at DESC`;

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            Logger.error('Error obteniendo compras a crédito del usuario', error);
            throw error;
        }
    }

    /**
     * Obtener una compra a crédito específica por ID
     * @param {string} purchaseId
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    async getById(purchaseId, userId) {
        try {
            const result = await pool.query(
                `SELECT cp.*, a.name as account_name
                FROM credit_purchases cp
                LEFT JOIN accounts a ON cp.account_id = a.account_id
                WHERE cp.purchase_id = $1 AND cp.user_id = $2`,
                [purchaseId, userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            Logger.error('Error obteniendo compra a crédito por ID', error);
            throw error;
        }
    }

    /**
     * Buscar compra a crédito por descripción (case-insensitive)
     * @param {string} description
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    async findByDescription(description, userId) {
        try {
            const result = await pool.query(
                `SELECT cp.*, a.name as account_name
                FROM credit_purchases cp
                LEFT JOIN accounts a ON cp.account_id = a.account_id
                WHERE LOWER(cp.description) = LOWER($1) AND cp.user_id = $2 AND cp.status = 'active'
                LIMIT 1`,
                [description, userId]
            );
            return result.rows[0] || null;
        } catch (error) {
            Logger.error('Error buscando compra a crédito por descripción', error);
            throw error;
        }
    }

    /**
     * Registrar pago de una cuota
     * @param {string} purchaseId
     * @param {string} userId
     * @param {number} amount - Monto del pago (puede ser parcial o múltiples cuotas)
     * @param {string} fromAccountId - ID de la cuenta desde donde se paga
     * @returns {Promise<Object>}
     */
    async recordPayment(purchaseId, userId, amount, fromAccountId = null) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Obtener compra actual
            const purchaseResult = await client.query(
                `SELECT cp.*, a.name as account_name
                FROM credit_purchases cp
                LEFT JOIN accounts a ON cp.account_id = a.account_id
                WHERE cp.purchase_id = $1 AND cp.user_id = $2`,
                [purchaseId, userId]
            );

            if (purchaseResult.rows.length === 0) {
                throw new Error('Compra a crédito no encontrada');
            }

            const purchase = purchaseResult.rows[0];

            // Calcular cuántas cuotas se pueden pagar con este monto
            const installmentsPaid = Math.floor(parseFloat(amount) / parseFloat(purchase.installment_amount));
            const newTotalPaid = parseInt(purchase.installments_paid) + installmentsPaid;
            const totalPaidAmount = parseFloat(purchase.total_paid_amount || 0) + parseFloat(amount);

            // Validar que no se pague más de lo debido
            if (newTotalPaid > purchase.installments) {
                throw new Error('El pago excede el número de cuotas restantes');
            }

            // Actualizar compra a crédito
            const updatedPurchase = await client.query(
                `UPDATE credit_purchases
                SET installments_paid = $1,
                    total_paid_amount = $2,
                    last_payment_date = NOW(),
                    status = CASE
                        WHEN $1 >= installments THEN 'paid'
                        ELSE status
                    END,
                    paid_at = CASE
                        WHEN $1 >= installments AND paid_at IS NULL THEN NOW()
                        ELSE paid_at
                    END
                WHERE purchase_id = $3 AND user_id = $4
                RETURNING *`,
                [newTotalPaid, totalPaidAmount, purchaseId, userId]
            );

            // Si se especificó cuenta de origen, crear transacción
            if (fromAccountId) {
                await client.query(
                    `INSERT INTO transactions
                    (user_id, account_id, type, amount, description, category_id, status)
                    VALUES ($1, $2, 'expense', $3, $4,
                        (SELECT category_id FROM categories WHERE name = 'Compras' AND user_id = $1 LIMIT 1),
                        'completed')`,
                    [userId, fromAccountId, amount, `Pago cuota: ${purchase.description}`]
                );

                // Actualizar balance de la cuenta
                await client.query(
                    `UPDATE accounts SET balance = balance - $1 WHERE account_id = $2`,
                    [amount, fromAccountId]
                );
            }

            await client.query('COMMIT');

            Logger.success(`💳 Pago de cuota: ${purchase.description} -$${amount} (${installmentsPaid} cuota${installmentsPaid > 1 ? 's' : ''})`);
            return updatedPurchase.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            Logger.error('Error registrando pago de cuota', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Actualizar una compra a crédito
     * @param {string} purchaseId
     * @param {string} userId
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async update(purchaseId, userId, updates) {
        try {
            const fields = [];
            const values = [];
            let paramCount = 1;

            const allowedFields = ['description', 'notes', 'status'];

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

            values.push(purchaseId, userId);

            const result = await pool.query(
                `UPDATE credit_purchases
                SET ${fields.join(', ')}, updated_at = NOW()
                WHERE purchase_id = $${paramCount} AND user_id = $${paramCount + 1}
                RETURNING *`,
                values
            );

            if (result.rows.length === 0) {
                throw new Error('Compra a crédito no encontrada');
            }

            Logger.success(`✅ Compra a crédito actualizada: ${result.rows[0].description}`);
            return result.rows[0];

        } catch (error) {
            Logger.error('Error actualizando compra a crédito', error);
            throw error;
        }
    }

    /**
     * Eliminar una compra a crédito
     * @param {string} purchaseId
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async delete(purchaseId, userId) {
        try {
            const result = await pool.query(
                `DELETE FROM credit_purchases
                WHERE purchase_id = $1 AND user_id = $2
                RETURNING *`,
                [purchaseId, userId]
            );

            if (result.rows.length === 0) {
                throw new Error('Compra a crédito no encontrada');
            }

            Logger.success(`🗑️ Compra a crédito eliminada: ${result.rows[0].description}`);
            return true;

        } catch (error) {
            Logger.error('Error eliminando compra a crédito', error);
            throw error;
        }
    }

    /**
     * Obtener resumen de compras a crédito de un usuario
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getSummary(userId) {
        try {
            const result = await pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE status = 'active') as active_count,
                    COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
                    COALESCE(SUM((installments - installments_paid) * installment_amount) FILTER (WHERE status = 'active'), 0) as total_remaining,
                    COALESCE(SUM(total_paid_amount), 0) as total_paid_overall,
                    COALESCE(SUM(installment_amount) FILTER (WHERE status = 'active'), 0) as monthly_payment
                FROM credit_purchases
                WHERE user_id = $1`,
                [userId]
            );

            return result.rows[0];
        } catch (error) {
            Logger.error('Error obteniendo resumen de compras a crédito', error);
            throw error;
        }
    }
}

module.exports = new CreditPurchaseDBService();
