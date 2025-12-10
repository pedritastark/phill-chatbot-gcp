const { TransactionDBService, CategoryDBService, AccountDBService, UserDBService } = require('./db');
const Logger = require('../utils/logger');

/**
 * Servicio de finanzas para gestionar gastos e ingresos
 * Usa PostgreSQL como base de datos
 */
class FinanceService {
  /**
   * Registra una nueva transacción
   * @param {string} userId - ID del usuario (phone_number)
   * @param {string} type - Tipo: 'expense' o 'income'
   * @param {number} amount - Monto
   * @param {string} description - Descripción
   * @param {string} categoryName - Nombre de la categoría (opcional)
   * @param {string} accountName - Nombre de la cuenta (opcional)
   * @returns {Promise<Object>}
   */
  async createTransaction(userId, type, amount, description, categoryName = null, accountName = null) {
    try {
      // 1. Buscar o crear el usuario
      const user = await UserDBService.findOrCreate({ phoneNumber: userId });

      // 2. Determinar la categoría
      let category = null;
      if (categoryName) {
        // Buscar o crear la categoría
        category = await CategoryDBService.findOrCreate(user.user_id, categoryName, type);
      } else {
        // Categorizar automáticamente
        const autoCategoryName = this.categorizeTransaction(description);
        category = await CategoryDBService.findOrCreate(user.user_id, autoCategoryName, type);
      }

      // 3. Determinar la cuenta
      let account = null;
      if (accountName) {
        // Buscar cuenta específica
        const accounts = await AccountDBService.findByUser(user.user_id);
        const matchingAccounts = accounts.filter(a => a.name.toLowerCase().includes(accountName.toLowerCase()));

        if (matchingAccounts.length > 0) {
          // Si es un gasto, priorizar cuenta con saldo suficiente
          if (type === 'expense') {
            account = matchingAccounts.find(a => parseFloat(a.balance) >= amount);
          }

          // Si no se encontró cuenta con saldo (o es ingreso), usar la primera que coincida
          if (!account) {
            account = matchingAccounts[0];
          }
        }

        // Si no se encuentra, usar default pero loguear warning
        if (!account) {
          Logger.warning(`Cuenta "${accountName}" no encontrada para ${userId}, usando default.`);
          account = await AccountDBService.getDefaultAccount(user.user_id);
        }
      } else {
        // Usar cuenta predeterminada
        account = await AccountDBService.getDefaultAccount(user.user_id);
      }

      // 4. Crear la transacción
      const transaction = await TransactionDBService.create({
        userId: user.user_id,
        accountId: account ? account.account_id : null,
        categoryId: category.category_id,
        type,
        amount,
        description,
        detectedByAI: true,
        confidenceScore: categoryName ? 1.0 : 0.8,
      });

      // 4.1 Actualizar saldo de la cuenta
      if (account) {
        // Asegurar que amount sea número
        const amountNum = parseFloat(amount);
        if (type === 'expense') {
          await AccountDBService.updateBalance(account.account_id, amountNum, 'subtract');
        } else if (type === 'income') {
          await AccountDBService.updateBalance(account.account_id, amountNum, 'add');
        }
      }

      // 5. Actualizar Racha (Streak)
      const today = new Date();
      // Ajustar a zona horaria Colombia para cálculo de fechas
      const colombiaTime = new Date(today.getTime() - (5 * 60 * 60 * 1000));
      const todayStr = colombiaTime.toISOString().split('T')[0];

      let lastActivityStr = null;
      if (user.last_activity_date) {
        const lastDate = new Date(user.last_activity_date);
        // Asumimos que last_activity_date ya se guardó correctamente, pero por si acaso
        const lastColombiaTime = new Date(lastDate.getTime() - (5 * 60 * 60 * 1000)); // Ajuste si viene en UTC
        // Mejor: Si la DB guarda DATE sin hora, user.last_activity_date será string YYYY-MM-DD o Date a medianoche UTC
        // Simplificación: Comparar strings YYYY-MM-DD
        lastActivityStr = new Date(user.last_activity_date).toISOString().split('T')[0];
      }

      let newStreak = user.current_streak || 0;
      let streakMessage = '';

      if (lastActivityStr !== todayStr) {
        // Calcular ayer
        const yesterday = new Date(colombiaTime);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

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

      Logger.finance(`Transacción registrada: ${type} de $${amount} para ${userId}. Racha: ${newStreak}`);

      return {
        ...transaction,
        category_name: category.name,
        category_icon: category.icon,
        account_name: account ? account.name : null,
        streak_info: {
          count: newStreak,
          message: streakMessage
        }
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

      const totalBalance = await AccountDBService.getTotalBalance(user.user_id);

      const result = {
        totalIncome: parseFloat(summary.total_income) || 0,
        totalExpenses: parseFloat(summary.total_expenses) || 0,
        balance: totalBalance,
        transactionCount: parseInt(summary.transaction_count) || 0,
        period: `últimos ${days} días`,
        avgExpense: parseFloat(summary.avg_expense) || 0,
        avgIncome: parseFloat(summary.avg_income) || 0,
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
      return parseFloat(res.rows[0].total);

    } catch (error) {
      Logger.error(`Error obteniendo gasto en categoría ${categoryName}`, error);
      return 0;
    }
  }

  /**
   * Categoriza automáticamente una transacción basándose en la descripción
   * @param {string} description - Descripción de la transacción
   * @returns {string} - Nombre de la categoría
   */
  categorizeTransaction(description) {
    const desc = description.toLowerCase();

    const categories = {
      'Alimentación': ['comida', 'restaurante', 'comí', 'almuerzo', 'desayuno', 'cena', 'café', 'pizza', 'hamburguesa', 'supermercado', 'mercado'],
      'Transporte': ['transporte', 'uber', 'taxi', 'gasolina', 'metro', 'bus', 'pasaje', 'combustible', 'estacionamiento'],
      'Entretenimiento': ['cine', 'netflix', 'spotify', 'juego', 'concierto', 'fiesta', 'bar', 'discoteca', 'teatro'],
      'Salud': ['doctor', 'medicina', 'farmacia', 'hospital', 'gym', 'gimnasio', 'médico', 'consulta', 'dentista'],
      'Servicios': ['luz', 'agua', 'internet', 'teléfono', 'renta', 'alquiler', 'arriendo', 'cable', 'gas'],
      'Educación': ['curso', 'libro', 'universidad', 'colegio', 'clases', 'matrícula', 'inscripción', 'escuela'],
      'Salario': ['salario', 'sueldo', 'pago', 'nómina', 'ingreso', 'trabajo'],
      'Inversiones': ['inversión', 'dividendo', 'interés', 'ganancia', 'rendimiento'],
      'Compras': ['compra', 'tienda', 'ropa', 'zapatos', 'electrónica', 'amazon', 'shopping'],
      'Vivienda': ['casa', 'hogar', 'muebles', 'decoración', 'reparación', 'mantenimiento'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => desc.includes(keyword))) {
        return category;
      }
    }

    return 'Otros Gastos';
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

module.exports = new FinanceService();
