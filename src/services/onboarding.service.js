const UserDBService = require('./db/user.db.service');
const AccountDBService = require('./db/account.db.service');
const Logger = require('../utils/logger');

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
                onboarding_step: 'name',
                onboarding_completed: false
            });

            return "¡Hola! Soy Phill, tu asistente financiero personal. 💜\n\nAntes de comenzar a organizar tus finanzas, me gustaría conocerte un poco.\n\n¿Cómo te llamas?";
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
            const user = await UserDBService.getUserByPhone(userId);

            if (!user) {
                throw new Error('Usuario no encontrado durante onboarding');
            }

            const step = user.onboarding_step;
            const cleanMessage = message.trim();

            switch (step) {
                case 'name':
                    return await this.handleNameStep(user, cleanMessage);

                case 'accounts':
                    return await this.handleAccountsStep(user, cleanMessage);

                default:
                    return "¡Ya casi terminamos! ¿Estás listo para comenzar? 💜";
            }

        } catch (error) {
            Logger.error(`Error procesando onboarding para ${userId}`, error);
            return "Lo siento, tuve un pequeño problema técnico. ¿Podemos intentar de nuevo? 💜";
        }
    }

    /**
     * Maneja el paso de nombre
     */
    async handleNameStep(user, name) {
        if (name.length < 2) {
            return "Ese nombre es muy corto. ¿Cómo te llamas realmente? 😊";
        }

        // Guardar nombre
        await UserDBService.updateUser(user.phone_number, {
            name: name,
            onboarding_step: 'accounts'
        });

        return `¡Un gusto conocerte, ${name}! 💜\n\nPara poder registrar tus gastos e ingresos, necesito saber qué cuentas usas.\n\nPor ejemplo: "Efectivo", "Bancolombia", "Nequi", "Davivienda".\n\nEscribe los nombres de tus cuentas separados por coma (o escribe "Efectivo" para empezar con lo básico).`;
    }

    /**
     * Maneja el paso de cuentas
     */
    async handleAccountsStep(user, accountsStr) {
        const accounts = accountsStr.split(/[,y\n]+/).map(a => a.trim()).filter(a => a.length > 0);

        if (accounts.length === 0) {
            return "Necesito al menos una cuenta para comenzar. ¿Qué tal si escribes 'Efectivo'? 😊";
        }

        // Crear cuentas
        let createdAccounts = [];
        for (const accName of accounts) {
            // Determinar tipo básico
            let type = 'savings';
            const lowerName = accName.toLowerCase();

            if (lowerName.includes('efectivo') || lowerName.includes('cash')) {
                type = 'cash';
            } else if (lowerName.includes('tarjeta') || lowerName.includes('crédito') || lowerName.includes('tc')) {
                type = 'credit_card';
            } else if (lowerName.includes('nequi') || lowerName.includes('daviplata')) {
                type = 'savings'; // Digital wallets as savings for simplicity
            }

            await AccountDBService.createAccount(user.user_id, {
                name: accName,
                type: type,
                balance: 0,
                isDefault: createdAccounts.length === 0 // La primera es default
            });
            createdAccounts.push(accName);
        }

        // Finalizar onboarding
        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'completed',
            onboarding_completed: true
        });

        return `¡Perfecto! He creado las siguientes cuentas: ${createdAccounts.join(', ')}.\n\n¡Ya estamos listos! 🚀\n\nPuedes empezar diciéndome cosas como:\n- "Registrar gasto de $20.000 en comida"\n- "Ingreso de $1.000.000 salario"\n- "¿Cómo van mis finanzas?"\n\n¿Qué quieres hacer primero? 💜`;
    }
}

module.exports = new OnboardingService();
