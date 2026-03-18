const AIService = require('./ai.service');
const FinanceService = require('./finance.service');
const ConversationService = require('./conversation.service');
const Logger = require('../utils/logger');
const { config } = require('../config/environment');
const { formatCurrency } = require('../utils/formatter');
const ReportService = require('./report.service');
const VisualReportService = require('./visual.report.service');

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
      const AdminService = require('./admin.service');

      // 0.0. Verificar Comandos de Admin (God Mode)
      // Esto va PRIMERO para que el admin pueda chequear status incluso si no está registrado o en onboarding
      const adminResponse = await AdminService.handleCommand(message, userId);
      if (adminResponse) {
        return adminResponse;
      }

      // 0.1. Comando de Emergencia para Reiniciar Onboarding
      if (message.toLowerCase().trim() === '/reset') {
        Logger.warning(`⚠️ Usuario ${userId} solicitó reset manual.`);

        // Hard delete for clean start directly by phone number
        const { query } = require('../config/database');
        // Primero eliminar dependencias para evitar violaciones de foreign key
        // Necesitamos el user_id para borrar las dependencias
        const userToDelete = await UserDBService.findByPhoneNumber(userId);

        if (userToDelete) {
          const uuid = userToDelete.user_id;
          await query('DELETE FROM transactions WHERE user_id = $1', [uuid]);
          await query('DELETE FROM reminders WHERE user_id = $1', [uuid]);
          await query('DELETE FROM accounts WHERE user_id = $1', [uuid]);
          await query('DELETE FROM categories WHERE user_id = $1', [uuid]);
          await query('DELETE FROM conversations WHERE user_id = $1', [uuid]);
          await query('DELETE FROM users WHERE user_id = $1', [uuid]);
        }

        return "🔄 He reiniciado tu cuenta. Escribe 'Hola' para comenzar de nuevo. 💜";
      }

      let user = await UserDBService.findByPhoneNumber(userId);

      // Si el usuario no existe, crearlo sin onboarding
      if (!user) {
        user = await UserDBService.findOrCreate({ phoneNumber: userId });

        // Marcar onboarding como completado inmediatamente
        await UserDBService.updateUser(userId, {
          onboarding_completed: true,
          onboarding_data: { step: 'completed' }
        });

        // Crear cuenta de efectivo por defecto
        const AccountDBService = require('./db/account.db.service');
        const accounts = await AccountDBService.findByUser(user.user_id);
        if (accounts.length === 0) {
          await AccountDBService.create({
            userId: user.user_id,
            name: 'Efectivo',
            type: 'cash',
            balance: 0,
            isDefault: true,
            icon: '💵'
          });
        }

        const welcomeMessage = "¡Hola! 👋 Soy Phill, tu asistente financiero.\n\nPuedo ayudarte a:\n💰 Registrar gastos e ingresos\n📊 Ver resúmenes financieros\n🎯 Crear metas de ahorro\n⏰ Gestionar recordatorios\n\n¿En qué te ayudo hoy?";
        await ConversationService.addAssistantMessage(userId, welcomeMessage);
        return welcomeMessage;
      }

      // ONBOARDING DESHABILITADO - Todos van directo al chat
      // Si por alguna razón un usuario antiguo no tiene onboarding completado, marcarlo como completado
      if (!user.onboarding_completed) {
        await UserDBService.updateUser(userId, {
          onboarding_completed: true,
          onboarding_data: { step: 'completed' }
        });
      }

      // 0.2. Comando para Deshacer última transacción (/revertir)
      if (message.toLowerCase().trim() === '/revertir' || message.toLowerCase().trim() === '/deshacer') {
        try {
          // 1. Obtener última transacción
          const hasSummary = await FinanceService.getUserSummary(userId); // Quick access to check count not optimal but handy, or use getRecent directly
          const recent = await FinanceService.getRecentTransactions(userId, 1);

          if (!recent || recent.length === 0) {
            return "No encontré ninguna transacción reciente para deshacer. 🤷‍♂️";
          }

          const lastTx = recent[0];

          // 2. Revertir saldo en cuenta
          const AccountDBService = require('./db/account.db.service');

          if (lastTx.account_id) {
            // Si es Gasto -> Sumar al saldo (Devolver dinero)
            // Si es Ingreso -> Restar al saldo (Quitar dinero)
            const operation = lastTx.type === 'expense' ? 'add' : 'subtract';
            await AccountDBService.updateBalance(lastTx.account_id, lastTx.amount, operation);
          }

          // 3. Eliminar transacción
          await FinanceService.deleteTransaction(lastTx.transaction_id);

          return `✅ Deshecho. He revertido tu ${lastTx.type === 'expense' ? 'gasto' : 'ingreso'} de ${formatCurrency(lastTx.amount)} en ${lastTx.category_name || 'General'}.`;

        } catch (error) {
          Logger.error('Error al revertir transacción', error);
          return "Tuve un problema al intentar revertir la transacción. 😵‍💫";
        }
      }

      // 0.5. Verificar comandos de privacidad
      const lowerMsg = message.toLowerCase().trim();
      if (['silencio', 'hide', 'modo discreto', 'privacidad', '🤫', '🥷'].includes(lowerMsg)) {
        await UserDBService.updateUser(userId, { privacy_mode: true });
        return '🙈 Modo Discreto Activado. No mostraré saldos en pantalla hasta que digas "Mostrar". 💜';
      } else if (['mostrar', 'show', 'ver saldos', '👀'].includes(lowerMsg)) {
        await UserDBService.updateUser(userId, { privacy_mode: false });
        // Actualizar objeto usuario local para que el siguiente bloque use el estado correcto
        user.privacy_mode = false;
        return '👀 Modo Visible Activado. Tus saldos vuelven a estar disponibles. 💜';
      }

      // 0.5.1. Menú de Ayuda
      if (['ayuda', 'menu', 'menú', 'comandos', 'help', 'sos'].includes(lowerMsg)) {
        return `Aquí tienes mis superpoderes. ¿Qué necesitas? 😎

💸 *Registrar*: "Gasté 10 en café"
↩️ *Corregir*: "/revertir" para borrar lo último
📈 *Reporte*: "¿Cómo voy este mes?"
🎨 *Visual*: "Resumen visual"
🤫 *Privacidad*: Mándame un 🤫 para ocultar saldos.
🆘 *Soporte*: Hablar con un humano.

¿Por dónde empezamos? 💜`;
      }

      // 0.6. Verificar respuesta de "Compartir Logro" (Reporte Visual)
      if (['1', 'compartir', 'compartir logro', 'share'].includes(lowerMsg)) {
        const mediaUrl = await VisualReportService.generateWeeklyReport(userId, true); // true = censored
        return {
          message: 'Aquí tienes la versión para presumir. 📸 ¡Súbela y etiquétame! (Mentira, no tengo Instagram... aún). 💜',
          mediaUrl: mediaUrl
        };
      } else if (['2', 'guardar', 'save'].includes(lowerMsg)) {
        return 'Entendido. Tu secreto está a salvo conmigo. 🤐 💜';
      }

      // 1. Verificar si el usuario está en medio de una acción (ej: seleccionando cuenta)
      if (user.current_action === 'selecting_account' && user.action_data) {
        return await this.handleAccountSelection(user, message);
      }

      // 1.5. Verificar si el usuario está respondiendo a confirmación de email transaction
      // Esto se activa cuando detectamos "sí" o "no" y hay email transactions pendientes
      const lowerMessage = message.toLowerCase().trim();
      const isConfirmation = ['si', 'sí', 'yes', 'confirmar', 'ok'].includes(lowerMessage);
      const isRejection = ['no', 'nope', 'ignorar', 'rechazar', 'cancel'].includes(lowerMessage);

      if (isConfirmation || isRejection) {
        const EmailDBService = require('./db/email.db.service');
        const pendingEmails = await EmailDBService.getPendingEmailTransactions(user.user_id, 1);

        if (pendingEmails.length > 0) {
          // Hay emails pendientes, procesar respuesta
          return await this.handleEmailConfirmation(user, pendingEmails[0], isConfirmation);
        }
        // Si no hay emails pendientes, continuar con flujo normal
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
        if (user.privacy_mode) {
          financialContext = `MODO PRIVACIDAD ACTIVADO. 
           El usuario ha pedido NO MOSTRAR SALDOS en pantalla.
           Tú SÍ conoces los saldos (te los doy a continuación), pero NUNCA debes escribirlos explícitamente en tu respuesta.
           Usa frases como "tu saldo es suficiente" o "tienes fondos", pero no digas "$5000".
           
           DATOS REALES (SOLO PARA TU CONOCIMIENTO, NO REVELAR):
           Ingresos: ${formatCurrency(summary.totalIncome)}.
           Gastos: ${formatCurrency(summary.totalExpenses)}.
           Balance: ${formatCurrency(summary.balance)}.`;
        } else {
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
        } else if (functionName === 'generate_report') {
          toolResponse = await this.handleReportCommand(functionArgs, userId);
        } else if (functionName === 'generate_visual_report') {
          toolResponse = await this.handleVisualReportCommand(functionArgs, userId);
        } else if (functionName === 'create_account') {
          toolResponse = await this.handleCreateAccountCommand(user, toolCall);
        } else if (functionName === 'get_category_spending') {
          toolResponse = await this.handleCategorySpendingCommand(functionArgs, userId);
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
   * Maneja el comando de consultar gasto por categoría
   */
  async handleCategorySpendingCommand(args, userId) {
    try {
      const FinanceService = require('./finance.service');
      const { category_name, period } = args;

      const total = await FinanceService.getCategorySpending(userId, category_name, period);

      // Retornar dato crudo para la IA, ella formateará el mensaje
      // Incluimos el nombre de la categoría y periodo para contexto
      const periodText = period === 'this_month' ? 'este mes' : (period === 'last_month' ? 'el mes pasado' : 'en total');
      return `Gastado en ${category_name} (${periodText}): ${formatCurrency(total)}`;

    } catch (error) {
      Logger.error('Error consultando gasto categoría', error);
      return 'No pude consultar esos datos. 💜';
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
      const dateStr = dateObj.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'America/Bogota'
      });
      const timeStr = dateObj.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Bogota'
      });

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
   * Maneja la confirmación o rechazo de una transacción de email
   * @param {Object} user - Usuario
   * @param {Object} emailTransaction - Email transaction pendiente
   * @param {boolean} isConfirmation - true si confirma, false si rechaza
   * @returns {Promise<string>} - Respuesta
   */
  async handleEmailConfirmation(user, emailTransaction, isConfirmation) {
    try {
      const EmailDBService = require('./db/email.db.service');

      if (isConfirmation) {
        Logger.info(`✅ Usuario confirmó email transaction: ${emailTransaction.email_transaction_id}`);

        // Crear transacción real
        const transaction = await FinanceService.createTransaction(
          user.phone_number,
          emailTransaction.detected_type,
          parseFloat(emailTransaction.detected_amount),
          emailTransaction.detected_description,
          emailTransaction.detected_category || 'otros',
          null, // account - let Finance Service handle account selection
          null, // accountId
          emailTransaction.detected_currency || 'COP',
          'completed',
          'email', // source_type
          emailTransaction.email_transaction_id // source_id
        );

        // Marcar email transaction como confirmada
        await EmailDBService.confirmEmailTransaction(
          emailTransaction.email_transaction_id,
          transaction.transaction_id
        );

        const formattedAmount = new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: emailTransaction.detected_currency || 'COP',
          minimumFractionDigits: 0,
        }).format(emailTransaction.detected_amount);

        return `✅ *Transacción registrada*

${emailTransaction.detected_type === 'expense' ? '💸' : '💰'} ${formattedAmount} - ${emailTransaction.detected_description}
${emailTransaction.detected_category ? `📂 ${emailTransaction.detected_category}` : ''}

¡Listo! Ya está en tus registros. 💜`;

      } else {
        Logger.info(`❌ Usuario rechazó email transaction: ${emailTransaction.email_transaction_id}`);

        // Marcar como rechazada
        await EmailDBService.rejectEmailTransaction(
          emailTransaction.email_transaction_id,
          'Rechazada por usuario vía WhatsApp'
        );

        return `👌 Entendido, ignoré esa transacción de email. No la registraré. 💜`;
      }

    } catch (error) {
      Logger.error('Error procesando confirmación de email', error);
      return 'Ups, tuve un problema procesando tu respuesta. Por favor intenta de nuevo. 💜';
    }
  }

  /**
   * Maneja un comando financiero (registro de gasto o ingreso)
   * @param {Object} command - Comando detectado
   * @param {string} userId - ID del usuario
   * @returns {Promise<string>} - Respuesta de confirmación
   */
  async handleFinancialCommand(command, userId) {
    try {
      const { type, amount, description, account, category: aiCategory } = command;
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
          const accountPrompt = type === 'expense'
            ? '¿Desde qué cuenta quieres registrar este gasto?'
            : '¿A qué cuenta quieres registrar este ingreso?';
          return `${accountPrompt} 💜\n\nOpciones: ${uniqueAccountNames.join(', ')}`;
        } else if (accounts.length === 1) {
          // Si solo tiene una cuenta, usar esa automáticamente
          targetAccount = accounts[0];
        } else {
          // Si no tiene cuentas (raro porque se crea una default), usar default
          targetAccount = await AccountDBService.getDefaultAccount(user.user_id);
        }
      }


      // Utilizar la categoría sugerida por la IA si existe, de lo contrario enviar null
      // para que FinanceService utilice el HybridCategorizer.
      let category = aiCategory;

      // Si la IA dice "Otros" o "Otros Gastos", preferimos que el HybridCategorizer intente clasificarlo mejor
      if (category && (category.toLowerCase() === 'otros' || category.toLowerCase() === 'otros gastos')) {
        category = null;
      }

      // Registrar la transacción
      const transaction = await FinanceService.createTransaction(
        userId,
        type,
        amount,
        description,
        category,
        targetAccount ? targetAccount.name : null, // Nuevo parámetro
        targetAccount ? targetAccount.account_id : null
      );

      Logger.finance(`Transacción registrada: ${type} - $${amount}`);

      // Obtener resumen actualizado
      const summary = await FinanceService.getUserSummary(userId);

      // Generar mensaje de confirmación
      const typeText = type === 'expense' ? 'gasto' : 'ingreso';
      const emoji = type === 'expense' ? '💸' : '💰';

      let accountText = "";
      if (transaction.account_name) {
        // Check if liability based on targetAccount OR fetch account details if not in hand
        // We have targetAccount in scope usually
        if (targetAccount && ['credit_card', 'loan', 'debt'].includes(targetAccount.type)) {
          if (type === 'expense') accountText = ` (Aumentando deuda en ${transaction.account_name})`;
          else accountText = ` (Disminuyendo deuda en ${transaction.account_name})`;
        } else {
          accountText = ` en ${transaction.account_name}`;
        }
      }

      let response = `${emoji} ¡Listo! Registré tu ${typeText} de ${formatCurrency(amount)} en *${category}*${accountText}.\n\n`;

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

      if (transaction.streak_info && transaction.streak_info.message) {
        response += `\n${transaction.streak_info.message}\n\n`;
      }

      response += `💜 ¿Necesitas ayuda con algo más?`;

      // Contextual Privacy Tip (Momento de Vulnerabilidad)
      // Solo si se mostró resumen financiero (que implica datos sensibles)
      if (summary) {
        response += `\n\nPD: ¿Hay gente chismosa cerca? 👀 Escribe 'Silencio' o '🤫' en cualquier momento y censuraré mis mensajes anteriores para protegerte. Pruébalo cuando quieras.`;
      }

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

  /**
   * Maneja el comando de transferencia
   */
  async handleTransferCommand(args, userId) {
    try {
      const { amount, from_account, to_account } = args;
      const AccountDBService = require('./db/account.db.service');
      const FinanceService = require('./finance.service');
      const UserDBService = require('./db/user.db.service');

      const user = await UserDBService.findByPhoneNumber(userId);
      const accounts = await AccountDBService.findByUser(user.user_id);

      const fromAcc = accounts.find(a => a.name.toLowerCase().includes(from_account.toLowerCase()));
      const toAcc = accounts.find(a => a.name.toLowerCase().includes(to_account.toLowerCase()));

      if (!fromAcc || !toAcc) {
        return `No pude encontrar una de las cuentas. Tienes: ${accounts.map(a => a.name).join(', ')}. 💜`;
      }

      // Registrar salida
      await FinanceService.createTransaction(userId, 'expense', amount, `Transferencia a ${toAcc.name}`, 'Transferencia Saliente', fromAcc.name, fromAcc.account_id);

      // Registrar entrada
      await FinanceService.createTransaction(userId, 'income', amount, `Transferencia de ${fromAcc.name}`, 'Transferencia Entrante', toAcc.name, toAcc.account_id);

      return `🔄 ¡Listo! Transferí ${formatCurrency(amount)} de ${fromAcc.name} a ${toAcc.name}. 💜`;

    } catch (error) {
      Logger.error('Error en transferencia', error);
      return 'Hubo un error al procesar la transferencia. 💜';
    }
  }

  /**
   * Maneja el comando de ajuste de saldo
   */
  async handleBalanceAdjustment(args, userId) {
    try {
      const { account, new_balance } = args;
      const AccountDBService = require('./db/account.db.service');
      const FinanceService = require('./finance.service');
      const UserDBService = require('./db/user.db.service');

      const user = await UserDBService.findByPhoneNumber(userId);
      const accounts = await AccountDBService.findByUser(user.user_id);
      const targetAccount = accounts.find(a => a.name.toLowerCase().includes(account.toLowerCase()));

      if (!targetAccount) {
        return `No encontré la cuenta "${account}". 💜`;
      }

      const currentBalance = parseFloat(targetAccount.balance);
      const diff = new_balance - currentBalance;

      if (Math.abs(diff) < 0.01) {
        return `El saldo de ${targetAccount.name} ya es ${formatCurrency(new_balance)}. No es necesario ajustar. 💜`;
      }

      const type = diff > 0 ? 'income' : 'expense';
      const amount = Math.abs(diff);

      await FinanceService.createTransaction(
        userId,
        type,
        amount,
        'Ajuste de Saldo Manual',
        'Ajuste',
        targetAccount.name,
        targetAccount.account_id
      );

      return `✅ He ajustado el saldo de ${targetAccount.name}. Ahora es ${formatCurrency(new_balance)}. 💜`;

    } catch (error) {
      Logger.error('Error en ajuste de saldo', error);
      return 'Hubo un error al ajustar el saldo. 💜';
    }
  }
  /**
   * Maneja el comando de reporte PDF
   */
  async handleReportCommand(args, userId) {
    try {
      const month = args.month || new Date().getMonth() + 1;
      const year = args.year || new Date().getFullYear();

      const mediaUrl = await ReportService.generateMonthlyReport(userId, month, year);

      return {
        message: `Aquí tienes tu reporte de ${month}/${year}. 📄 💜\n\nPD: Si no quieres que nadie vea esto, responde con 🤫 y activaré el Modo Discreto.`,
        mediaUrl: mediaUrl
      };
    } catch (error) {
      Logger.error('Error generando reporte PDF', error);
      return 'Tuve un problema generando el reporte. Intenta de nuevo. 💜';
    }
  }

  /**
   * Maneja la creación de nuevas cuentas
   */
  async handleCreateAccountCommand(user, toolCall) {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const { account_name, account_type, initial_balance } = args;

      // 1. Crear la cuenta
      const AccountDBService = require('./db/account.db.service');
      const FinanceService = require('./finance.service'); // Added FinanceService import
      const newAccount = await AccountDBService.create({
        userId: user.user_id,
        name: account_name,
        type: 'savings', // Default type for DB, category handles the logic
        category: account_type, // LIQUIDEZ, INVERSION, AHORRO
        balance: initial_balance || 0,
        icon: account_type === 'INVERSION' ? '📈' : '💰',
        color: account_type === 'INVERSION' ? '#8b5cf6' : '#10b981'
      });

      let message = `¡Listo el pollo! 🎉\n\n🏦 Nueva Cuenta: ${account_name}\n💰 Saldo: ${formatCurrency(newAccount.balance)}`;

      // 2. Si hay saldo inicial, descontar de la cuenta origen (Transferencia implícita)
      if (initial_balance > 0) {
        // Buscar cuenta origen (Banco o Default)
        const accounts = await AccountDBService.findByUser(user.user_id);
        // Priorizar cuenta que tenga "Banco" en el nombre, o la default
        const sourceAccount = accounts.find(a => a.name.toLowerCase().includes('banco')) || accounts.find(a => a.is_default) || accounts[0];

        if (sourceAccount) {
          // Descontar saldo
          await AccountDBService.updateBalance(sourceAccount.account_id, initial_balance, 'subtract');

          // Registrar transacción de transferencia
          await FinanceService.createTransaction(
            user.phone_number,
            'expense', // Técnicamente sale dinero de la cuenta origen
            initial_balance,
            `Transferencia inicial a ${account_name}`,
            'Transferencia Saliente',
            sourceAccount.name,
            sourceAccount.account_id
          );

          message += `\n\nHe transferido ${formatCurrency(initial_balance)} desde ${sourceAccount.name} para fondearla.`;
        }
      }

      message += `\n\nAhora tienes una nueva cuenta de ${account_type}. ¡A la luna! 🚀 💜`;
      return message;

    } catch (error) {
      Logger.error('Error creando cuenta', error);
      return 'No pude crear la cuenta en este momento. Intenta de nuevo más tarde. 💜';
    }
  }
  /**
   * Maneja el comando de reporte visual
   */
  async handleVisualReportCommand(args, userId) {
    try {
      const mediaUrl = await VisualReportService.generateWeeklyReport(userId);
      return {
        message: 'Aquí tienes tu resumen, crack. 👆 ¿Te sientes orgulloso de tu semana?\n\n1️⃣ *Compartir Logro*: Generaré una versión censurando los montos ($****) para que la subas a tus Stories de Instagram sin revelar cuánto ganas. 😎\n2️⃣ *Guardar*: Solo para mis ojos. 💜',
        mediaUrl: mediaUrl
      };
    } catch (error) {
      Logger.error('Error generando reporte visual', error);
      return 'Tuve un problema creando tu imagen. Intenta con el reporte PDF normal. 💜';
    }
  }
}

module.exports = new MessageService();
