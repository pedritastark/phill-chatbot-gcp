const { TransactionDBService, CategoryDBService, AccountDBService, UserDBService } = require('./db');
const Logger = require('../utils/logger');
const HybridCategorizer = require('./categorizer');
const Decimal = require('decimal.js');
const { DateTime } = require('luxon');

/**
 * Servicio de finanzas para gestionar gastos e ingresos
 * Usa PostgreSQL como base de datos
 */
class FinanceService {
  /**
   * Categoriza una transacción usando el categorizador híbrido
   * @param {string} text - Descripción de la transacción
   * @returns {string} - Categoría predicha
   */
  /**
   * Categoriza una transacción usando el categorizador híbrido
   * @param {string} text - Descripción de la transacción
   * @returns {Promise<string>} - Categoría predicha
   */
  async categorizeTransaction(text) {
    const result = await HybridCategorizer.categorize(text);
    return result ? result.categoria : 'Otros';
  }

  /**
   * Registra una nueva transacción
   * @param {string} userId - ID del usuario (phone_number)
   * @param {string} type - Tipo: 'expense' o 'income'
   * @param {number} amount - Monto
   * @param {string} description - Descripción
   * @param {string} categoryName - Nombre de la categoría (opcional)
   * @param {string} currency - Moneda (opcional, default 'COP')
   * @param {string} status - Estado (opcional, default 'completed')
   * @returns {Promise<Object>}
   */
  async createTransaction(userId, type, amount, description, categoryName = null, accountName = null, accountId = null, currency = 'COP', status = 'completed') {
    try {
      const user = await UserDBService.findOrCreate({ phoneNumber: userId });

      // 1.5. CONCILIACIÓN DE PENDIENTES
      // Si el usuario reporta un gasto pagado, verificar si ya existía como pendiente.
      if (type === 'expense' && status === 'completed') {
        const pendingMatch = await TransactionDBService.findPendingMatch(user.user_id, amount, description);

        if (pendingMatch) {
          Logger.info(`🔄 Conciliación exitosa: Resolviendo pendiente ID ${pendingMatch.transaction_id}`);

          // Actualizar la transacción existente a completed
          const updatedTx = await TransactionDBService.updateStatus(pendingMatch.transaction_id, 'completed');

          // Continuar con lógica de actualización de saldos usando la cuenta real
          // Necesitamos determinar la cuenta (paso 3) antes de descontar
          // Pero adelantemos la selección de cuenta para usarla

          let resolvedAccount = accountName
            ? (await AccountDBService.findByUser(user.user_id)).find(a => a.name.toLowerCase().includes(accountName.toLowerCase()))
            : null;

          if (!resolvedAccount) resolvedAccount = await AccountDBService.getDefaultAccount(user.user_id);

          // Descontar saldo
          if (resolvedAccount) {
            const isLiability = ['credit_card', 'loan', 'debt'].includes(resolvedAccount.type);
            let op = isLiability ? 'add' : 'subtract';
            const safeAmount = new Decimal(amount).toNumber();
            await AccountDBService.updateBalance(resolvedAccount.account_id, safeAmount, op);
          }

          return {
            ...updatedTx,
            was_pending_resolved: true,
            confirmation_text: `✅ Excelente, marqué tu pendiente de ${description} como pagado.`
          };
        }
      }

      // 2. Determinar la categoría
      let category = null;
      let confidence = 1.0;
      let detectedByAI = false;

      if (categoryName) {
        // Buscar o crear la categoría explícita
        category = await CategoryDBService.findOrCreate(user.user_id, categoryName, type);
      } else {
        // Categorizar automáticamente usando HybridCategorizer
        const catResult = await HybridCategorizer.categorize(description);

        let autoCategoryName = 'Otros Gastos';
        if (catResult && catResult.categoria) {
          autoCategoryName = catResult.categoria;
          confidence = catResult.confianza;
          detectedByAI = true;
        }

        Logger.info(`Categoría detectada: ${autoCategoryName} (Confianza: ${confidence})`);

        // Mapear 'Otros' a 'Otros Gastos' si es necesario para consistencia
        if (autoCategoryName === 'Otros') autoCategoryName = 'Otros Gastos';

        category = await CategoryDBService.findOrCreate(user.user_id, autoCategoryName, type);
      }

      // 3. Determinar la cuenta
      let account = null;

      if (accountId) {
        const candidate = await AccountDBService.findById(accountId);
        if (candidate && candidate.user_id === user.user_id) {
          account = candidate;
        }
      }

      if (!account && accountName) {
        const accounts = await AccountDBService.findByUser(user.user_id);
        const matchingAccounts = accounts.filter(a => a.name.toLowerCase().includes(accountName.toLowerCase()));

        if (matchingAccounts.length > 0) {
          if (type === 'expense') {
            account = matchingAccounts.find(a => parseFloat(a.balance) >= amount);
          }

          if (!account) {
            account = matchingAccounts[0];
          }
        }

        if (!account) {
          Logger.warning(`Cuenta "${accountName}" no encontrada para ${userId}, usando default.`);
          account = await AccountDBService.getDefaultAccount(user.user_id);
        }
      }

      if (!account) {
        account = await AccountDBService.getDefaultAccount(user.user_id);
      }

      if (account && account.type === 'credit_card' && type === 'expense') {
        const limit = new Decimal(account.credit_limit || 0);
        const used = new Decimal(account.balance || 0);
        const projected = used.plus(amount);

        if (limit.gt(0) && projected.gt(limit)) {
          const err = new Error('Cupo insuficiente en la tarjeta de crédito.');
          err.code = 'CREDIT_LIMIT_EXCEEDED';
          throw err;
        }
      }

      // 4. Crear la transacción
      const transaction = await TransactionDBService.create({
        userId: user.user_id,
        accountId: account ? account.account_id : null,
        categoryId: category.category_id,
        type,
        amount,
        description,
        detectedByAI: detectedByAI,
        confidenceScore: confidence,
        currency: currency || 'COP', // Default safe
        status: status || 'completed' // Default safe
      });

      // 4.5. Actualizar el saldo de la cuenta (SOLO SI ESTÁ COMPLETADA)
      // Si está pendiente, no movemos el dinero aún.
      if (account && status === 'completed') {
        const isLiability = ['credit_card', 'loan', 'debt'].includes(account.type);
        let operation = 'add';

        if (isLiability) {
          // Si es Pasivo
          if (type === 'expense') operation = 'add'; // Aumenta la deuda (Gasto con TC)
          else if (type === 'income') operation = 'subtract'; // Disminuye la deuda (Pagar TC)
        } else {
          // Si es Activo
          if (type === 'expense') operation = 'subtract'; // Disminuye el dinero
          else if (type === 'income') operation = 'add'; // Aumenta el dinero
        }

        // Usamos Decimal para asegurar precisión al pasar el monto
        const safeAmount = new Decimal(amount).toNumber();
        await AccountDBService.updateBalance(account.account_id, safeAmount, operation);
      }

      // 5. Actualizar Racha (Streak) usando Luxon para 'America/Bogota'
      const nowBogota = DateTime.now().setZone('America/Bogota');
      const todayStr = nowBogota.toFormat('yyyy-MM-dd');

      let lastActivityStr = null;
      if (user.last_activity_date) {
        // Asumimos que last_activity_date viene como Date o string YYYY-MM-DD
        lastActivityStr = DateTime.fromJSDate(new Date(user.last_activity_date))
          .setZone('America/Bogota')
          .toFormat('yyyy-MM-dd');
      }

      let newStreak = user.current_streak || 0;
      let streakMessage = '';

      if (lastActivityStr !== todayStr) {
        // Calcular ayer
        const yesterdayStr = nowBogota.minus({ days: 1 }).toFormat('yyyy-MM-dd');

        if (lastActivityStr === yesterdayStr) {
          newStreak++;
          streakMessage = `🔥 ¡${newStreak} días en racha!`;
        } else {
          newStreak = 1;
          streakMessage = '🔥 ¡Empezaste una nueva racha!';
        }

        // Actualizar usuario
        await UserDBService.updateUser(userId, {
          current_streak: newStreak,
          last_activity_date: todayStr
        });
      } else {
        streakMessage = `🔥 Racha actual: ${newStreak} días`;
      }

      Logger.finance(`Transacción registrada: ${type} de ${currency} $${amount} para ${userId}. Estado: ${status}`);

      return {
        ...transaction,
        category_name: category.name,
        category_icon: category.icon,
        account_name: account ? account.name : null,
        streak_info: {
          count: newStreak,
          message: streakMessage
        },
        // Info extra para UI/Respuesta
        is_pending: status === 'pending',
        confirmation_text: status === 'pending'
          ? `🗓️ ¡Entendido! Te recordaré este pago de $${amount} ${currency}.`
          : null
      };

    } catch (error) {
      Logger.error('Error al crear transacción', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las transacciones de un usuario
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @param {Object} filters - Filtros opcionales
   * @returns {Promise<Array>}
   */
  async getUserTransactions(phoneNumber, filters = {}) {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        Logger.warning(`Usuario no encontrado: ${phoneNumber}`);
        return [];
      }

      return await TransactionDBService.findByUser(user.user_id, filters);
    } catch (error) {
      Logger.error('Error al obtener transacciones del usuario', error);
      return [];
    }
  }

  /**
   * Obtiene un resumen financiero del usuario
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @param {number} days - Días a incluir (por defecto 30)
   * @returns {Promise<Object|null>}
   */
  async getUserSummary(phoneNumber, days = 30) {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        Logger.warning(`Usuario no encontrado: ${phoneNumber}`);
        return null;
      }

      // Determinar el periodo
      let period = 'month';
      if (days <= 1) period = 'day';
      else if (days <= 7) period = 'week';
      else if (days <= 30) period = 'month';
      else if (days <= 365) period = 'year';
      else period = 'all';

      const summary = await TransactionDBService.getSummary(user.user_id, period);

      const totalBalanceVal = await AccountDBService.getTotalBalance(user.user_id);

      // 🎯 refactor: Usar Decimal para cálculos precisos
      const totalIncome = new Decimal(summary.total_income || 0);
      const totalExpenses = new Decimal(summary.total_expenses || 0);
      const balance = new Decimal(totalBalanceVal || 0);

      const result = {
        totalIncome: totalIncome.toNumber(),
        totalExpenses: totalExpenses.toNumber(),
        balance: balance.toNumber(),
        transactionCount: parseInt(summary.transaction_count) || 0,
        period: `últimos ${days} días`,
        avgExpense: new Decimal(summary.avg_expense || 0).toNumber(),
        avgIncome: new Decimal(summary.avg_income || 0).toNumber(),
      };

      Logger.finance(`Resumen generado para ${phoneNumber}: Balance $${result.balance}`);
      return result;

    } catch (error) {
      Logger.error('Error al generar resumen financiero', error);
      return null;
    }
  }

  /**
   * Obtiene el balance actual de un usuario
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @returns {Promise<number>}
   */
  async getUserBalance(phoneNumber) {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        return 0;
      }

      return await AccountDBService.getTotalBalance(user.user_id);
    } catch (error) {
      Logger.error('Error al obtener balance del usuario', error);
      return 0;
    }
  }

  /**
   * Obtiene transacciones agrupadas por categoría
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @param {number} days - Días a incluir
   * @returns {Promise<Array>}
   */
  async getTransactionsByCategory(phoneNumber, days = 30) {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        return [];
      }

      let period = 'month';
      if (days <= 7) period = 'week';
      else if (days <= 30) period = 'month';
      else if (days <= 365) period = 'year';
      else period = 'all';

      return await TransactionDBService.getByCategory(user.user_id, period);
    } catch (error) {
      Logger.error('Error al obtener transacciones por categoría', error);
      return [];
    }
  }

  /**
   * Obtiene las últimas transacciones de un usuario
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @param {number} limit - Límite de transacciones
   * @returns {Promise<Array>}
   */
  async getRecentTransactions(phoneNumber, limit = 10) {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        return [];
      }

      return await TransactionDBService.getRecent(user.user_id, limit);
    } catch (error) {
      Logger.error('Error al obtener transacciones recientes', error);
      return [];
    }
  }

  /**
   * Obtiene el gasto total en una categoría específica
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @param {string} categoryName - Nombre de la categoría
   * @param {string} period - Periodo ('this_month', 'last_month', 'all_time')
   * @returns {Promise<number>}
   */
  async getCategorySpending(phoneNumber, categoryName, period = 'this_month') {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) return 0;

      // Normalizar nombre de categoría para coincidir con DB
      let normalizedCategory = categoryName;
      const term = categoryName.toLowerCase();

      if (['comida', 'almuerzo', 'cena', 'desayuno', 'restaurante'].some(k => term.includes(k))) {
        normalizedCategory = 'Alimentación';
      } else if (['transporte', 'uber', 'taxi', 'bus'].some(k => term.includes(k))) {
        normalizedCategory = 'Transporte';
      }
      // Agregar más mapeos si es necesario, o confiar en que el usuario diga el nombre exacto

      const { query } = require('../config/database');
      let dateFilter = "";
      const params = [user.user_id, `%${normalizedCategory}%`]; // Partial match for robustness

      if (period === 'this_month') {
        dateFilter = "AND t.created_at >= date_trunc('month', CURRENT_DATE)";
      } else if (period === 'last_month') {
        dateFilter = "AND t.created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND t.created_at < date_trunc('month', CURRENT_DATE)";
      }
      // 'all_time' no agrega filtro de fecha

      const sql = `
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.category_id
        WHERE t.user_id = $1
        AND t.type = 'expense'
        AND c.name ILIKE $2
        ${dateFilter}
      `;

      const res = await query(sql, params);
      return new Decimal(res.rows[0].total || 0).toNumber();

    } catch (error) {
      Logger.error(`Error obteniendo gasto en categoría ${categoryName}`, error);
      return 0;
    }
  }

  /**
   * Elimina una transacción
   * @param {string} transactionId - UUID de la transacción
   * @returns {Promise<void>}
   */
  async deleteTransaction(transactionId) {
    try {
      await TransactionDBService.delete(transactionId);
      Logger.info(`Transacción eliminada: ${transactionId}`);
    } catch (error) {
      Logger.error('Error al eliminar transacción', error);
      throw error;
    }
  }

  /**
   * Actualiza una transacción
   * @param {string} transactionId - UUID de la transacción
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>}
   */
  async updateTransaction(transactionId, updateData) {
    try {
      return await TransactionDBService.update(transactionId, updateData);
    } catch (error) {
      Logger.error('Error al actualizar transacción', error);
      throw error;
    }
  }

  /**
   * Busca transacciones por texto
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @param {string} searchText - Texto a buscar
   * @returns {Promise<Array>}
   */
  async searchTransactions(phoneNumber, searchText) {
    try {
      const user = await UserDBService.findByPhoneNumber(phoneNumber);
      if (!user) {
        return [];
      }

      return await TransactionDBService.search(user.user_id, searchText);
    } catch (error) {
      Logger.error('Error al buscar transacciones', error);
      return [];
    }
  }
}

// --- SNIPPET DE PRUEBA MANUAL ---
/*
// Copia y pega esto en un archivo temporal para probar:
const financeService = require('./src/services/finance.service');
const Logger = require('./src/utils/logger');

async function test() {
  try {
    console.log('🧪 Probando creación con Currency y Status...');
    const result = await financeService.createTransaction(
      'whatsapp:+573000000000', // Pon tu número real si quieres verlo en DB
      'expense',
      12.50,
      'Netflix Mensual',
      'Suscripciones',
      null,
      null,
      'USD',
      'pending'
    );
    console.log('✅ Resultado:', result);
  } catch (e) {
    console.error('❌ Error:', e);
  }
}
// test();
*/

module.exports = new FinanceService();
