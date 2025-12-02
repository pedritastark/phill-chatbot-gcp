const UserDBService = require('./db/user.db.service');
const AccountDBService = require('./db/account.db.service');
const FinanceService = require('./finance.service');
const ReminderDBService = require('./db/reminder.db.service');
const Logger = require('../utils/logger');
const { formatCurrency } = require('../utils/formatter');

class OnboardingService {

    /**
     * Inicia el proceso de onboarding para un usuario
     * @param {string} userId - ID del usuario (teléfono)
     * @returns {Promise<string>} - Mensaje de bienvenida
     */
    async startOnboarding(userId) {
        try {
            // Asegurar que el usuario tenga el estado correcto
            await UserDBService.updateUser(userId, {
                onboarding_step: 'cash_balance',
                onboarding_completed: false,
                onboarding_data: {} // Inicializar datos temporales
            });

            return "¡Hola! Qué bueno que decidiste tomar el control de tu dinero. Soy Phill, tu nuevo asistente financiero, y vamos a poner orden en tus cuentas de una vez por todas. 🚀\n\nPara empezar con el pie derecho, necesito los números claros. Cuéntame, ¿cuánto efectivo tienes en tu cartera ahora mismo? 💜";
        } catch (error) {
            Logger.error(`Error iniciando onboarding para ${userId}`, error);
            throw error;
        }
    }

    /**
     * Procesa un mensaje dentro del flujo de onboarding
     * @param {string} userId - ID del usuario (teléfono)
     * @param {string} message - Mensaje del usuario
     * @returns {Promise<string>} - Respuesta del bot
     */
    async processMessage(userId, message) {
        try {
            const user = await UserDBService.findByPhoneNumber(userId);

            if (!user) {
                throw new Error('Usuario no encontrado durante onboarding');
            }

            const step = user.onboarding_step;
            const cleanMessage = message.trim();

            switch (step) {
                case 'cash_balance':
                    return await this.handleCashBalanceStep(user, cleanMessage);

                case 'bank_balance':
                    return await this.handleBankBalanceStep(user, cleanMessage);

                case 'first_expense':
                    return await this.handleFirstExpenseStep(user, cleanMessage);

                case 'expense_account':
                    return await this.handleExpenseAccountStep(user, cleanMessage);

                case 'coach_intro':
                    return await this.handleCoachIntroStep(user, cleanMessage);

                case 'reminder_setup':
                    return await this.handleReminderSetupStep(user, cleanMessage);

                default:
                    return "¡Ya casi terminamos! ¿Estás listo para comenzar? 💜";
            }

        } catch (error) {
            Logger.error(`Error procesando onboarding para ${userId}`, error);
            return "Lo siento, tuve un pequeño problema técnico. ¿Podemos intentar de nuevo? 💜";
        }
    }

    /**
     * Paso 1: Recibe saldo en efectivo -> Pide saldo en banco
     */
    async handleCashBalanceStep(user, message) {
        const amount = this.parseAmount(message);

        // Guardar dato temporalmente
        const data = user.onboarding_data || {};
        data.cash = amount;

        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'bank_balance',
            onboarding_data: data
        });

        return `Anotado. 💵 Efectivo: ${formatCurrency(amount)}.\n\nAhora pasemos a lo digital. ¿Cuál es el saldo aproximado de tu cuenta bancaria principal? (Solo necesito el monto total para tus reportes, nada de claves ni datos sensibles). 😎`;
    }

    /**
     * Paso 2: Recibe saldo banco -> Crea cuentas -> Pide primer gasto
     */
    async handleBankBalanceStep(user, message) {
        const amount = this.parseAmount(message);
        const data = user.onboarding_data || {};
        const cashBalance = data.cash || 0;

        // Crear cuentas reales
        await AccountDBService.create({
            userId: user.user_id,
            name: 'Efectivo',
            type: 'cash',
            balance: cashBalance,
            isDefault: true,
            icon: '💵',
            color: '#10b981'
        });

        await AccountDBService.create({
            userId: user.user_id,
            name: 'Banco',
            type: 'savings',
            balance: amount,
            isDefault: false,
            icon: '🏦',
            color: '#3b82f6'
        });

        const total = cashBalance + amount;

        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'first_expense',
            onboarding_data: {} // Limpiar datos temporales
        });

        return `Perfecto. 🏦 Banco: ${formatCurrency(amount)}.\n\n💸 Tu Patrimonio Inicial es de ${formatCurrency(total)}. Ya tengo la base lista. De aquí en adelante, yo me encargo de rastrear cada peso. 💜\n\nHagamos una prueba rápida para que veas lo simple que es.\n\nDime un gasto que hayas hecho hoy. Escríbelo natural, como si se lo contaras a un amigo. Por ejemplo: 'Gasté 20.000 en el desayuno'.`;
    }

    /**
     * Paso 3: Recibe primer gasto -> Detecta datos -> Pide cuenta
     */
    async handleFirstExpenseStep(user, message) {
        // Usar lógica simple de parsing o llamar a FinanceService si es posible
        // Aquí simularemos una detección básica para el onboarding
        const amount = this.parseAmount(message);
        const description = message; // Usar todo el mensaje como descripción

        // Guardar datos del gasto pendiente
        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'expense_account',
            onboarding_data: {
                pending_expense: {
                    amount: amount,
                    description: description
                }
            }
        });

        return `Entendido. ¿Usaste 💵 Efectivo o tarjeta del 💳 Banco? Responde con el nombre de la cuenta.`;
    }

    /**
     * Paso 4: Recibe cuenta -> Registra gasto -> Explica Coach -> Pide preguntas
     */
    async handleExpenseAccountStep(user, message) {
        const accountName = message.toLowerCase();
        const data = user.onboarding_data || {};
        const expense = data.pending_expense;

        let targetAccountName = 'Efectivo';
        if (accountName.includes('banco') || accountName.includes('tarjeta')) {
            targetAccountName = 'Banco';
        }

        // Registrar la transacción real
        const category = FinanceService.categorizeTransaction(expense.description);
        await FinanceService.createTransaction(
            user.phone_number,
            'expense',
            expense.amount,
            expense.description,
            category,
            targetAccountName
        );

        // Obtener nuevo saldo
        const accounts = await AccountDBService.findByUser(user.user_id);
        const updatedAccount = accounts.find(a => a.name === targetAccountName);

        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'coach_intro',
            onboarding_data: {}
        });

        return `✅ Listo. Registré ${formatCurrency(expense.amount)} en ${category} (${targetAccountName}). 🏦 Tu nuevo saldo en ${targetAccountName} es: ${formatCurrency(updatedAccount.balance)}.\n\nAsí de fácil funciona. Tú vives tu vida, yo hago las matemáticas. 💜\n\nOjo, no solo sirvo para restar gastos. Mi trabajo es ayudarte a que tu dinero crezca. 📈\n\nPuedes preguntarme cosas como:\n- ¿Cómo armo un fondo de emergencia?\n- ¿Qué estrategia de ahorro me recomiendas?\n\n¿Tienes alguna duda financiera ahora o seguimos?`;
    }

    /**
     * Paso 5: Recibe pregunta/no -> Responde (si es pregunta) -> Propone recordatorio
     */
    async handleCoachIntroStep(user, message) {
        // Si el usuario hace una pregunta, idealmente deberíamos responderla con IA.
        // Pero para simplificar el flujo de onboarding, asumiremos que si dice "No" o "Seguimos", pasamos.
        // Si pregunta algo, podríamos responder brevemente o decir "Hablemos de eso luego".
        // Siguiendo el script, el usuario dice "No por ahora".

        // Independientemente de lo que diga, pasamos al cierre para asegurar la retención.

        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'reminder_setup'
        });

        return `Excelente. Una última cosa: la constancia es clave aquí.\n\nVoy a escribirte a las 8 PM para hacer un cierre rápido del día. Así nos aseguramos de que no se te escape ningún gasto hormiga. ¿Trato hecho? 💜`;
    }

    /**
     * Paso 6: Recibe confirmación -> Programa recordatorio -> Fin
     */
    async handleReminderSetupStep(user, message) {
        // Programar recordatorio diario a las 8 PM
        const now = new Date();
        const scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
        if (scheduledTime < now) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        await ReminderDBService.createReminder({
            userId: user.user_id,
            message: "Hora del cierre diario 🌙. ¿Qué gastos hiciste hoy?",
            scheduledAt: scheduledTime,
            isRecurring: true,
            recurrencePattern: 'daily'
        });

        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'completed',
            onboarding_completed: true
        });

        return `¡Trato hecho! 🤝 Te escribiré a las 8 PM.\n\n¡Bienvenido a Phill! Tu camino a la libertad financiera empieza hoy. 🚀`;
    }

    /**
     * Extrae un número de un mensaje
     */
    parseAmount(text) {
        const clean = text.replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.]/g, '');
        return parseFloat(clean) || 0;
    }
}

module.exports = new OnboardingService();
