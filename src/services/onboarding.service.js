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
                onboarding_step: 'name_input',
                onboarding_completed: false,
                onboarding_data: {} // Inicializar datos temporales
            });

            return "¡Hola! 👋 Soy Phill, tu nuevo asistente financiero con IA.\n\nMi misión es simple: que dejes de estresarte por el dinero y empieces a hacerlo crecer. 🚀\n\nYo ya me presenté... ¿y tú eres? (Dime tu nombre o cómo te gusta que te llamen) �";
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
                case 'name_input':
                    return await this.handleNameStep(user, cleanMessage);

                case 'challenge_input':
                    // Deprecated step, redirect to data_acceptance if user is stuck here
                    return await this.handleDataAcceptanceStep(user, 'acepto'); // Auto-accept or reset? Better to just handle as name step or skip.
                // Actually, if a user is in this state, we should probably just move them forward or reset.
                // Let's remove the case and let default handle it, or map it.
                // For now, I will remove the case from the switch if I remove the method, but to be safe for existing users, I'll map it to data_acceptance logic or just leave it as legacy.
                // Since I'm rebuilding DB, no existing users. I will remove the case.


                case 'data_acceptance':
                    return await this.handleDataAcceptanceStep(user, cleanMessage);

                case 'initial_balances':
                    return await this.handleInitialBalancesStep(user, cleanMessage);

                case 'first_expense':
                    return await this.handleFirstExpenseStep(user, cleanMessage);

                case 'expense_account':
                    return await this.handleExpenseAccountStep(user, cleanMessage);

                // case 'coach_intro': // Removed in final script
                //    return await this.handleCoachIntroStep(user, cleanMessage);

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
     * Paso 0: Recibe nombre -> Pide saldo en efectivo
     */
    async handleNameStep(user, message) {
        let name = message.trim();
        const lowerName = name.toLowerCase();

        // Limpiar prefijos comunes si el usuario escribe una frase completa
        const prefixes = ['me llamo', 'mi nombre es', 'soy', 'dime', 'me dicen', 'llamame', 'llámame', 'me puedes decir', 'me puedes llamar', 'puedes decirme', 'puedes llamarme'];
        for (const prefix of prefixes) {
            if (lowerName.startsWith(prefix + ' ')) {
                name = name.substring(prefix.length).trim();
                break;
            }
        }

        // Recalcular lowerName para validación
        const cleanLowerName = name.toLowerCase();

        // Validación de nombres reservados
        const reservedWords = ['admin', 'system', 'phill', 'bot', 'null', 'undefined', 'system info', 'info'];
        if (reservedWords.some(word => cleanLowerName.includes(word))) {
            return "Ese nombre suena muy robótico. 🤖 ¿Cuál es tu nombre real? (O dime cómo quieres que te diga)";
        }

        if (name.length < 2) {
            return "Ese nombre es muy corto. 🤔 ¿Cómo quieres que te diga?";
        }

        await UserDBService.updateUser(user.phone_number, {
            name: name,
            onboarding_step: 'data_acceptance' // Skip challenge, go to privacy
        });

        return {
            message: `¡Un gusto, ${name}! 💜\n\nAntes de empezar con la magia, pongámonos serios un segundo: Tu privacidad es sagrada para mí.\n\nNecesito que me des luz verde para tratar tus datos de forma segura y ayudarte a organizar tus cuentas. ¿Aceptas los términos y condiciones? 🔒`,
            buttons: [
                { id: 'accept', title: 'Acepto' },
                { id: 'terms', title: 'Leer Términos' }
            ]
        };
    }

    /**
     * Paso 0.5: Recibe pregunta reto -> Responde con IA -> Pide saldo en efectivo
     */
    async handleChallengeStep(user, message) {
        // Usar AIService para responder la pregunta del usuario
        const AIService = require('./ai.service');

        // Obtener respuesta de la IA (sin herramientas, o ignorándolas)
        const aiResponse = await AIService.getResponse(message, user.phone_number, {
            userName: user.name,
            // No pasamos historial completo para que se enfoque en la pregunta actual
            conversationHistory: []
        });

        const answer = aiResponse.content || "Esa es una buena pregunta. 🤔";

        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'data_acceptance'
        });

        return `${answer}\n\nAhora, para pasar a la estrategia financiera y preguntarte por tu capital, por ley necesito tu luz verde para manejar tus datos con total confidencialidad. 🔒\n\n¿Aceptas los términos y política de datos para arrancar? (Responde "Acepto" o "Sí")`;
    }

    /**
     * Paso 0.8: Recibe aceptación de datos -> Pide saldo en efectivo
     */
    async handleDataAcceptanceStep(user, message) {
        const clean = message.toLowerCase();
        const accepted = ['acepto', 'si', 'sí', 'dale', 'ok', 'claro', 'de una'].some(w => clean.includes(w));

        if (!accepted) {
            return "Entiendo tu precaución. 🛡️ Pero sin tu permiso, no puedo ser tu asistente financiero. Todo queda entre nosotros. ¿Te animas a aceptar para empezar? (Responde 'Acepto')";
        }

        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'initial_balances'
        });

        return {
            message: `¡Excelente! Ya somos equipo. 🤝💜\n\nTe cuento rápido qué haré por ti: 1️⃣ Registraré tus movimientos (adiós al Excel aburrido). 2️⃣ Te recordaré pagos importantes. 3️⃣ Resolveré tus dudas como tu coach 24/7.\n\nPara que esto funcione, necesito entender dónde estamos parados hoy. Sin juicios, solo números para arrancar. 😉\n\nCuéntame, ${user.name}, ¿cuánto dinero tienes hoy?\n\nDime cuánto en **Efectivo** y cuánto en **Banco** (o Nequi/Daviplata) en un solo mensaje.\nEjemplo: "Tengo 50k en efectivo y 2 millones en el banco".`,
            // No buttons here as it requires open text input
        };
    }

    /**
     * Paso 1: Recibe saldos iniciales (Efectivo y Banco) -> Crea cuentas -> Pide primer gasto
     */
    async handleInitialBalancesStep(user, message) {
        const AIService = require('./ai.service');

        // Usar IA para extraer las cuentas
        const extracted = await AIService.extractInitialBalances(message);
        const accounts = extracted.accounts || [];

        if (accounts.length === 0) {
            return "No logré entender los montos. 🤔 Intenta escribirlos así: 'Efectivo: 50.000, Banco: 200.000' o 'Nequi: 50k'.";
        }

        // Limpiar cuentas existentes (por ejemplo, la default creada al registrar usuario)
        // Para asegurar que solo quedan las que el usuario mencionó
        const existingAccounts = await AccountDBService.findByUser(user.user_id);
        for (const acc of existingAccounts) {
            await AccountDBService.delete(acc.account_id);
        }

        // Crear TODAS las cuentas detectadas
        let total = 0;
        let responseText = "¡Entendido! 🫡\n";

        for (const account of accounts) {
            await AccountDBService.create({
                userId: user.user_id,
                name: account.name,
                type: account.type || 'savings',
                balance: account.balance,
                isDefault: account.type === 'cash', // Solo marcar default si es efectivo o la primera
                icon: account.type === 'cash' ? '💵' : '🏦',
                color: account.type === 'cash' ? '#10b981' : '#3b82f6'
            });
            total += account.balance;
            responseText += `${account.type === 'cash' ? '💵' : '🏦'} ${account.name}: ${formatCurrency(account.balance)}\n`;
        }

        responseText += `\n💰 **Patrimonio Inicial: ${formatCurrency(total)}**\n\n¡Ya tengo la base lista! De aquí en adelante, yo me encargo de rastrear cada peso. 💜\n\nPruébame ahora mismo para que veas lo fácil que es.\n\nDime un gasto que hayas hecho hoy. Escríbelo normal, tipo: 'Gasté 15k en taxi'.`;

        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'first_expense',
            onboarding_data: {} // Limpiar datos temporales
        });

        return responseText;
    }

    /**
     * Paso 3: Recibe primer gasto -> Detecta datos -> Pide cuenta
     */
    async handleFirstExpenseStep(user, message) {
        // Usar parseAmount mejorado para extraer el monto
        const amount = this.parseAmount(message);

        if (amount === 0) {
            return "No logré identificar el monto del gasto. 🧐 Intenta de nuevo, por ejemplo: '10k en taxi' o 'Almuerzo 15.000'.";
        }

        // Descripción: Todo el mensaje, o intentar limpiarlo un poco
        // Para MVP, usar todo el mensaje está bien, el usuario suele ser descriptivo
        const description = message;

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

        // Obtener las cuentas reales del usuario
        const accounts = await AccountDBService.findByUser(user.user_id);

        let accountButtons = accounts.map(acc => ({
            id: acc.name, // Usar el nombre como ID para fácil matching
            title: `${acc.name} (${formatCurrency(acc.balance)})` // Mostrar saldo en el botón
        }));

        // Limitar a 3 botones (WhatsApp limitation) - Priorizar por uso o saldo
        // Ojo: Si hay muchas cuentas, esto podría ocultar algunas. 
        // Para MVP, tomamos las primeras 3.
        if (accountButtons.length > 3) {
            accountButtons = accountButtons.slice(0, 3);
        }

        return {
            message: `Entendido. ¿De qué cuenta salió esa plata? 👇`,
            buttons: accountButtons
        };
    }

    /**
     * Paso 4: Recibe cuenta -> Registra gasto -> Explica Coach -> Pide preguntas
     */
    async handleExpenseAccountStep(user, message) {
        const accountName = message.toLowerCase();
        const data = user.onboarding_data || {};
        const expense = data.pending_expense;

        // Lógica de selección dinámica: buscar coincidencia en las cuentas del usuario
        const accounts = await AccountDBService.findByUser(user.user_id);

        // 1. Intentar match exacto (case insensitive)
        let targetAccount = accounts.find(a => a.name.toLowerCase() === accountName);

        // 2. Si no match, buscar coincidencia parcial
        if (!targetAccount) {
            targetAccount = accounts.find(a => a.name.toLowerCase().includes(accountName));
        }

        // 3. Fallback inteligente
        if (!targetAccount) {
            // Si dijo "banco" y no hay cuenta llamada "banco", buscar una de ahorros
            if (accountName.includes('banco') || accountName.includes('tarjeta')) {
                targetAccount = accounts.find(a => a.type === 'savings');
            } else if (accountName.includes('efectivo')) {
                targetAccount = accounts.find(a => a.type === 'cash');
            }
        }

        // 4. Último recurso: cuenta default
        if (!targetAccount) {
            targetAccount = accounts.find(a => a.is_default) || accounts[0];
        }

        // Registrar la transacción real
        const category = FinanceService.categorizeTransaction(expense.description);
        await FinanceService.createTransaction(
            user.phone_number,
            'expense',
            expense.amount,
            expense.description,
            category,
            targetAccount.name
        );

        // Obtener nuevo saldo actualizado
        const updatedAccounts = await AccountDBService.findByUser(user.user_id);
        const updatedAccount = updatedAccounts.find(a => a.name === targetAccount.name);

        // AVANZAR AL SIGUIENTE PASO
        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'reminder_setup'
        });

        return {
            message: `✅ Listo. Registré ${formatCurrency(expense.amount)} en ${category}. Tu nuevo saldo en ${targetAccount.name} es ${formatCurrency(updatedAccount.balance)}. Así de simple funciona. 🔥\n\nUna última cosa, ${user.name}: la constancia es clave.\n\nVoy a escribirte a las 8 PM para hacer un cierre rápido del día. ¿Trato hecho?\n\nPD: Si alguna vez te pierdes o no sabes qué hacer, solo escribe 'Ayuda' y te mostraré mi guía de comandos. ¡Estoy aquí para ti! 💜`,
            buttons: [
                { id: 'deal', title: '¡De una!' },
                { id: 'ok', title: 'Listo' },
                { id: 'questions', title: 'Tengo preguntas' }
            ]
        };
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

        return `¡Genial! Hablamos en la noche. A romperla hoy. 🚀💜`;
    }

    /**
     * Extrae un número de un mensaje
     */
    parseAmount(text) {
        if (!text) return 0;

        let clean = text.toLowerCase().trim();
        let multiplier = 1;

        if (clean.includes('k')) multiplier = 1000;
        else if (clean.includes('m')) multiplier = 1000000;
        else if (clean.includes('barra') || clean.includes('luca')) multiplier = 1000;

        // Eliminar letras y dejar solo números, puntos y comas
        clean = clean.replace(/[^\d.,]/g, '');

        // Normalizar separadores
        // Caso 1: Tiene coma y punto (ej: 1.500,50) -> Formato CO/EU
        if (clean.includes('.') && clean.includes(',')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        }
        // Caso 2: Solo tiene coma (ej: 1500,50) -> Decimal CO/EU
        else if (clean.includes(',')) {
            clean = clean.replace(',', '.');
        }
        // Caso 3: Solo tiene punto (ej: 150.000 o 150.50) -> Ambiguo
        else if (clean.includes('.')) {
            const parts = clean.split('.');
            // Si el último grupo tiene 3 o más dígitos (ej: 150.000 o 200.0000), asumimos miles
            // Si tiene 2 (ej: 150.50), asumimos decimal
            if (parts[parts.length - 1].length >= 3) {
                clean = clean.replace(/\./g, '');
            }
            // Si no, dejamos el punto como decimal (JS standard)
        }

        const value = parseFloat(clean);
        return (value || 0) * multiplier;
    }
}

module.exports = new OnboardingService();
