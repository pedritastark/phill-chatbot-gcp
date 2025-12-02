const AIService = require('./ai.service');
const FinanceService = require('./finance.service');
const ConversationService = require('./conversation.service');
const Logger = require('../utils/logger');
const { config } = require('../config/environment');
const { formatCurrency } = require('../utils/formatter');

/**
 * Servicio para procesar mensajes de usuarios
 */
class MessageService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Inicializa el servicio
   */
  async initialize() {
    if (!this.initialized) {
      await ConversationService.initialize();
      this.initialized = true;
      Logger.success('MessageService inicializado con soporte de conversaciones');
    }
  }
  /**
   * Procesa un mensaje del usuario y genera una respuesta
   * @param {string} message - Mensaje del usuario
   * @param {string} userId - ID del usuario (teléfono)
   * @returns {Promise<string>} - Respuesta para el usuario
   */
  async processMessage(message, userId) {
    try {
      // Asegurar que el servicio está inicializado
      await this.initialize();

      Logger.user(`Procesando mensaje de ${userId}`);
      Logger.info(`Mensaje: "${message}"`);

      // 0. Verificar usuario y onboarding
      const UserDBService = require('./db/user.db.service');
      const OnboardingService = require('./onboarding.service');

      let user = await UserDBService.findByPhoneNumber(userId);

      // Si el usuario no existe, crearlo e iniciar onboarding
      if (!user) {
        user = await UserDBService.findOrCreate({ phoneNumber: userId });
        const welcomeMessage = await OnboardingService.startOnboarding(userId);
        await ConversationService.addAssistantMessage(userId, welcomeMessage);
        return welcomeMessage;
      }

      // Si el onboarding no está completo, procesar con OnboardingService
      if (!user.onboarding_completed) {
        const onboardingResponse = await OnboardingService.processMessage(userId, message);
        await ConversationService.addAssistantMessage(userId, onboardingResponse);
        return onboardingResponse;
      }

      // 1. Verificar si el usuario está en medio de una acción (ej: seleccionando cuenta)
      if (user.current_action === 'selecting_account' && user.action_data) {
        return await this.handleAccountSelection(user, message);
      }

      // 3. Obtener historial de conversación ANTES de guardar el mensaje actual
      // (últimos 10 mensajes = 5 intercambios anteriores)
      const conversationHistory = await ConversationService.getHistoryForAI(userId);

      if (conversationHistory.length > 0) {
        Logger.info(`💬 Contexto: ${conversationHistory.length} mensajes previos`);
      }

      // 4. Obtener contexto financiero del usuario
      const summary = await FinanceService.getUserSummary(userId);

      let financialContext = null;
      if (summary && summary.transactionCount > 0) {
        // Obtener desglose de cuentas
        const AccountDBService = require('./db/account.db.service');
        const accounts = await AccountDBService.findByUser(user.user_id);
        const accountBreakdown = accounts.map(a => `${a.name}: ${formatCurrency(a.balance)}`).join(', ');

        financialContext = `El usuario ha registrado ${summary.transactionCount} transacciones en los ${summary.period}. 
        Ingresos totales: ${formatCurrency(summary.totalIncome)}. 
        Gastos totales: ${formatCurrency(summary.totalExpenses)}. 
        BALANCE TOTAL REAL (Suma de cuentas): ${formatCurrency(summary.balance)}.
        Desglose por cuenta: ${accountBreakdown}.`;
      }

      // 5. Obtener respuesta de la IA con contexto completo
      const aiResponse = await AIService.getResponse(message, userId, {
        financialSummary: financialContext,
        conversationHistory: conversationHistory,
        userName: user.name
      });

      // 6. Guardar el mensaje del usuario
      await ConversationService.addUserMessage(userId, message);

      // 7. Verificar si hay llamadas a herramientas (Function Calling)
      if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
        Logger.info(`🛠️ Detectadas ${aiResponse.tool_calls.length} llamadas a herramientas`);

        // Por ahora procesamos solo la primera herramienta para simplificar
        // (OpenAI puede devolver varias, pero en este caso de uso suele ser una)
        const toolCall = aiResponse.tool_calls[0];
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        Logger.info(`🔧 Ejecutando herramienta: ${functionName}`);
        Logger.info(`📋 Argumentos: ${JSON.stringify(functionArgs)}`);

        let toolResponse = '';

        if (functionName === 'register_transaction') {
          toolResponse = await this.handleFinancialCommand(functionArgs, userId);
        } else if (functionName === 'set_reminder') {
          toolResponse = await this.handleReminderCommand(functionArgs, userId);
        } else {
          Logger.warning(`⚠️ Herramienta desconocida: ${functionName}`);
          toolResponse = 'Lo siento, intenté hacer algo que no sé cómo hacer. 💜';
        }

        // Guardar la respuesta de la herramienta como mensaje del asistente
        await ConversationService.addAssistantMessage(userId, toolResponse);
        return toolResponse;
      }

      // 8. Si no hay herramientas, es una respuesta de texto normal
      const content = aiResponse.content;

      if (content) {
        await ConversationService.addAssistantMessage(userId, content);

        // Log de advertencia si la respuesta de IA es muy larga
        if (content.length > config.messaging.recommendedLength) {
          Logger.warning(
            `🚨 IA SUPERÓ EL LÍMITE: ${content.length} caracteres ` +
            `(máximo recomendado: ${config.messaging.recommendedLength}). ` +
            `⚠️ Esto aumenta costos operacionales. El mensaje será dividido.`
          );
        } else {
          Logger.success(
            `✅ Respuesta dentro del límite: ${content.length}/${config.messaging.recommendedLength} caracteres`
          );
        }

        return content;
      }

      return '... 💜'; // Fallback por si acaso

    } catch (error) {
      Logger.error('Error al procesar mensaje', error);
      throw error;
    }
  }

  /**
   * Maneja el comando de recordatorio (Function Calling)
   */
  async handleReminderCommand(args, userId) {
    try {
      const ReminderDBService = require('./db/reminder.db.service');
      const UserDBService = require('./db/user.db.service');

      // Obtener UUID del usuario
      const user = await UserDBService.findByPhoneNumber(userId);

      if (!user) {
        return 'No pude encontrar tu usuario para guardar el recordatorio. 💜';
      }

      // Guardar recordatorio
      await ReminderDBService.createReminder({
        userId: user.user_id,
        message: args.message,
        scheduledAt: args.datetime,
        isRecurring: args.is_recurring || false,
        recurrencePattern: args.recurrence_pattern || null
      });

      // Respuesta de confirmación
      const dateObj = new Date(args.datetime);
      const dateStr = dateObj.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
      const timeStr = dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

      let confirmation = `✅ ¡Hecho! Te recordaré "${args.message}" el ${dateStr} a las ${timeStr}`;

      if (args.is_recurring) {
        const patterns = { daily: 'todos los días', weekly: 'cada semana', monthly: 'cada mes', yearly: 'cada año' };
        const patternText = patterns[args.recurrence_pattern] || 'recurrentemente';
        confirmation += ` (${patternText})`;
      }

      confirmation += '. 💜';
      return confirmation;

    } catch (error) {
      Logger.error('Error al crear recordatorio', error);
      return 'Tuve un problema técnico guardando tu recordatorio. Intenta de nuevo. 💜';
    }
  }

  /**
   * Maneja la selección de cuenta cuando el usuario tiene una acción pendiente
   */
  async handleAccountSelection(user, message) {
    const UserDBService = require('./db/user.db.service');
    const AccountDBService = require('./db/account.db.service');

    const command = user.action_data;
    const accountName = message.trim();

    // Buscar la cuenta mencionada
    const accounts = await AccountDBService.findByUser(user.user_id);
    const selectedAccount = accounts.find(a => a.name.toLowerCase().includes(accountName.toLowerCase()));

    if (!selectedAccount) {
      return `No encontré una cuenta llamada "${accountName}". Por favor elige una de tus cuentas: ${accounts.map(a => a.name).join(', ')}. 💜`;
    }

    // Completar la transacción
    command.account = selectedAccount.name; // Actualizar con el nombre real

    // Limpiar estado
    await UserDBService.updateUser(user.phone_number, {
      current_action: null,
      action_data: null
    });

    // Ejecutar comando
    return await this.handleFinancialCommand(command, user.phone_number);
  }

  /**
   * Maneja un comando financiero (registro de gasto o ingreso)
   * @param {Object} command - Comando detectado
   * @param {string} userId - ID del usuario
   * @returns {Promise<string>} - Respuesta de confirmación
   */
  async handleFinancialCommand(command, userId) {
    try {
      const { type, amount, description, account } = command;
      const AccountDBService = require('./db/account.db.service');
      const UserDBService = require('./db/user.db.service');

      // Obtener usuario para ID
      const user = await UserDBService.findByPhoneNumber(userId);

      // Lógica de selección de cuenta
      let targetAccount = null;

      if (account) {
        // Si el usuario especificó cuenta, buscarla
        const accounts = await AccountDBService.findByUser(user.user_id);
        targetAccount = accounts.find(a => a.name.toLowerCase().includes(account.toLowerCase()));

        if (!targetAccount) {
          return `No encontré la cuenta "${account}". Tus cuentas son: ${accounts.map(a => a.name).join(', ')}. ¿Cuál quieres usar? 💜`;
        }
      } else {
        // Si no especificó, verificar cuántas cuentas tiene
        const accounts = await AccountDBService.findByUser(user.user_id);

        if (accounts.length > 1) {
          // Si tiene múltiples y no especificó, PREGUNTAR
          // Guardar estado
          await UserDBService.updateUser(userId, {
            current_action: 'selecting_account',
            action_data: command
          });

          // Deduplicar nombres de cuentas para la lista
          const uniqueAccountNames = [...new Set(accounts.map(a => a.name))];
          return `¿Desde qué cuenta quieres registrar este ${type === 'expense' ? 'gasto' : 'ingreso'}? 💜\n\nOpciones: ${uniqueAccountNames.join(', ')}`;
        } else if (accounts.length === 1) {
          // Si solo tiene una cuenta, usar esa automáticamente
          targetAccount = accounts[0];
        } else {
          // Si no tiene cuentas (raro porque se crea una default), usar default
          targetAccount = await AccountDBService.getDefaultAccount(user.user_id);
        }
      }

      // Categorizar automáticamente
      const category = FinanceService.categorizeTransaction(description);

      // Registrar la transacción
      // Nota: Necesitamos actualizar createTransaction para aceptar accountId explícito si lo tenemos
      // Por ahora FinanceService.createTransaction usa default si no se pasa nada.
      // Vamos a asumir que FinanceService.createTransaction será actualizado o usaremos lógica aquí.
      // Espera, FinanceService.createTransaction NO acepta accountId explícito en su firma actual: (userId, type, amount, description, categoryName)
      // Debemos actualizar FinanceService también.

      // Por ahora, pasamos el nombre de la cuenta en la descripción o modificamos FinanceService.
      // Mejor modifiquemos FinanceService para aceptar accountName.

      const transaction = await FinanceService.createTransaction(
        userId,
        type,
        amount,
        description,
        category,
        targetAccount ? targetAccount.name : null // Nuevo parámetro
      );

      Logger.finance(`Transacción registrada: ${type} - $${amount}`);

      // Obtener resumen actualizado
      const summary = await FinanceService.getUserSummary(userId);

      // Generar mensaje de confirmación
      const typeText = type === 'expense' ? 'gasto' : 'ingreso';
      const emoji = type === 'expense' ? '💸' : '💰';
      const accountText = transaction.account_name ? ` en ${transaction.account_name}` : '';

      let response = `${emoji} ¡Listo! Registré tu ${typeText} de ${formatCurrency(amount)} en ${category}${accountText}.\n\n`;

      if (summary) {
        response += `📊 Resumen de tus ${summary.period}:\n`;
        response += `• Ingresos: ${formatCurrency(summary.totalIncome)}\n`;
        response += `• Gastos: ${formatCurrency(summary.totalExpenses)}\n`;
        response += `• Balance: ${formatCurrency(summary.balance)}\n\n`;

        // Agregar insight simple
        if (summary.balance < 0) {
          response += `⚠️ Estás gastando más de lo que ingresas. Te recomiendo revisar tus gastos y buscar áreas donde puedas ahorrar.\n\n`;
        } else if (summary.balance > 0) {
          response += `✅ ¡Vas bien! Estás ahorrando. Considera invertir ese excedente para que crezca con el tiempo.\n\n`;
        }
      }

      response += `💜 ¿Necesitas ayuda con algo más?`;

      // Log de advertencia si la confirmación es muy larga
      if (response.length > config.messaging.recommendedLength) {
        Logger.warning(
          `🚨 Confirmación superó el límite: ${response.length} caracteres ` +
          `(máximo: ${config.messaging.recommendedLength}). Esto aumenta costos.`
        );
      } else {
        Logger.success(
          `✅ Confirmación dentro del límite: ${response.length}/${config.messaging.recommendedLength} caracteres`
        );
      }

      return response;

    } catch (error) {
      Logger.error('Error al manejar comando financiero', error);
      return 'Lo siento, hubo un error al registrar tu transacción. Por favor, inténtalo de nuevo.';
    }
  }

  /**
   * Valida que un mensaje no esté vacío y tenga longitud mínima
   * @param {string} message - Mensaje a validar
   * @returns {Object} - { valid: boolean, error: string|null }
   */
  validateMessage(message) {
    if (!message || message.trim() === '') {
      return { valid: false, error: 'empty' };
    }

    const cleanMessage = message.trim().replace(/\s+/g, ' ');
    if (cleanMessage.length < 2) {
      return { valid: false, error: 'too_short' };
    }

    return { valid: true, error: null };
  }
}

module.exports = new MessageService();

