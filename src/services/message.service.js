const AIService = require('./ai.service');
const FinanceService = require('./finance.service');
const ConversationService = require('./conversation.service');
const Logger = require('../utils/logger');
const { config } = require('../config/environment');

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

      // 1. Detectar si es un comando financiero
      const financialCommand = AIService.detectFinancialCommand(message);

      if (financialCommand) {
        // Guardar el mensaje del usuario
        await ConversationService.addUserMessage(userId, message);

        const response = await this.handleFinancialCommand(financialCommand, userId);

        // Guardar la respuesta del asistente
        await ConversationService.addAssistantMessage(userId, response);
        return response;
      }

      // 2. Obtener historial de conversación ANTES de guardar el mensaje actual
      // (últimos 10 mensajes = 5 intercambios anteriores)
      const conversationHistory = ConversationService.getHistoryForGemini(userId);

      if (conversationHistory.length > 0) {
        Logger.info(`💬 Contexto: ${conversationHistory.length} mensajes previos`);
      }

      // 3. Obtener contexto financiero del usuario
      const summary = await FinanceService.getUserSummary(userId);

      let financialContext = null;
      if (summary && summary.transactionCount > 0) {
        financialContext = `El usuario ha registrado ${summary.transactionCount} transacciones en los ${summary.period}. Ingresos totales: $${summary.totalIncome.toFixed(2)}, Gastos totales: $${summary.totalExpenses.toFixed(2)}, Balance: $${summary.balance.toFixed(2)}.`;
      }

      // 4. Obtener respuesta de la IA con contexto completo
      const aiResponse = await AIService.getResponse(message, userId, {
        financialSummary: financialContext,
        conversationHistory: conversationHistory,
      });

      // 5. AHORA sí, guardar el mensaje del usuario y la respuesta en el historial
      // 5. AHORA sí, guardar el mensaje del usuario
      await ConversationService.addUserMessage(userId, message);

      // Verificar si la respuesta es un JSON de recordatorio
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);

      if (jsonMatch) {
        try {
          const command = JSON.parse(jsonMatch[1]);

          if (command.type === 'reminder') {
            const ReminderDBService = require('./db/reminder.db.service');
            const UserDBService = require('./db/user.db.service');

            // Obtener UUID del usuario
            const user = await UserDBService.getUserByPhone(userId);

            if (user) {
              // Guardar recordatorio
              await ReminderDBService.createReminder({
                userId: user.user_id,
                message: command.message,
                scheduledAt: command.datetime
              });

              // Respuesta de confirmación
              const dateObj = new Date(command.datetime);
              const dateStr = dateObj.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
              const timeStr = dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

              const confirmation = `✅ ¡Hecho! Te recordaré "${command.message}" el ${dateStr} a las ${timeStr}. 💜`;

              await ConversationService.addAssistantMessage(userId, confirmation);
              return confirmation;
            } else {
              Logger.error(`Usuario no encontrado para recordatorio: ${userId}`);
              // If user not found, we can't create the reminder.
              // Return a generic error or the original AI response (cleaned).
              const cleanResponse = aiResponse.replace(/```json[\s\S]*```/, '').trim() || 'Entendido, pero tuve un problema técnico procesando el recordatorio porque no pude encontrar tu información de usuario. 💜';
              await ConversationService.addAssistantMessage(userId, cleanResponse);
              return cleanResponse;
            }
          }
        } catch (e) {
          Logger.error('Error al procesar JSON de IA', e);
          // Si falla, enviar la respuesta original limpia de bloques de código
          const cleanResponse = aiResponse.replace(/```json[\s\S]*```/, '').trim() || 'Entendido, pero tuve un problema técnico procesando el recordatorio. 💜';
          await ConversationService.addAssistantMessage(userId, cleanResponse);
          return cleanResponse;
        }
      }

      // Respuesta normal
      await ConversationService.addAssistantMessage(userId, aiResponse);

      // 6. Log de advertencia si la respuesta de IA es muy larga
      if (aiResponse.length > config.messaging.recommendedLength) {
        Logger.warning(
          `🚨 IA SUPERÓ EL LÍMITE: ${aiResponse.length} caracteres ` +
          `(máximo recomendado: ${config.messaging.recommendedLength}). ` +
          `⚠️ Esto aumenta costos operacionales. El mensaje será dividido.`
        );
      } else {
        Logger.success(
          `✅ Respuesta dentro del límite: ${aiResponse.length}/${config.messaging.recommendedLength} caracteres`
        );
      }

      return aiResponse;

    } catch (error) {
      Logger.error('Error al procesar mensaje', error);
      throw error;
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
      const { type, amount, description } = command;

      // Categorizar automáticamente
      const category = FinanceService.categorizeTransaction(description);

      // Registrar la transacción
      const transaction = await FinanceService.createTransaction(
        userId,
        type,
        amount,
        description,
        category
      );

      Logger.finance(`Transacción registrada: ${type} - $${amount}`);

      // Obtener resumen actualizado
      const summary = await FinanceService.getUserSummary(userId);

      // Generar mensaje de confirmación
      const typeText = type === 'expense' ? 'gasto' : 'ingreso';
      const emoji = type === 'expense' ? '💸' : '💰';

      let response = `${emoji} ¡Listo! Registré tu ${typeText} de $${amount.toFixed(2)} en ${category}.\n\n`;

      if (summary) {
        response += `📊 Resumen de tus ${summary.period}:\n`;
        response += `• Ingresos: $${summary.totalIncome.toFixed(2)}\n`;
        response += `• Gastos: $${summary.totalExpenses.toFixed(2)}\n`;
        response += `• Balance: $${summary.balance.toFixed(2)}\n\n`;

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

