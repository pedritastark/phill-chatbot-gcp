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

        return `¡Un gusto conocerte, ${name}! 💜\n\nPara organizar tus finanzas, necesito saber qué cuentas usas y cuánto dinero tienes en ellas.\n\nPor ejemplo:\n"Efectivo: 50.000, Nequi: 200.000"\n\nEscribe tus cuentas y sus saldos separados por coma.`;
    }

    /**
     * Maneja el paso de cuentas
     */
    async handleAccountsStep(user, accountsStr) {
        // Separar por comas o saltos de línea
        const accountsRaw = accountsStr.split(/[,;\n]+/).map(a => a.trim()).filter(a => a.length > 0);

        if (accountsRaw.length === 0) {
            return "Necesito al menos una cuenta para comenzar. ¿Qué tal si escribes 'Efectivo: 0'? 😊";
        }

        // Crear cuentas
        let createdAccounts = [];

        for (const raw of accountsRaw) {
            // Intentar extraer nombre y monto
            // Regex busca: (Nombre de cuenta) (separador opcional) (Monto con posibles puntos/comas)
            const match = raw.match(/^(.+?)(?:[:\s\$]+)([\d\.,]+)$/);

            let name, balance = 0;

            if (match) {
                name = match[1].trim();
                // Limpiar monto: quitar puntos (miles) y dejar solo números y punto decimal si hay
                // Asumimos formato local: 1.000.000 (miles con punto) -> 1000000
                let amountStr = match[2].replace(/\./g, '').replace(',', '.');
                balance = parseFloat(amountStr) || 0;
            } else {
                // Si no hay monto explícito, asumir 0
                name = raw;
                balance = 0;
            }

            // Determinar tipo básico
            let type = 'savings';
            const lowerName = name.toLowerCase();

            if (lowerName.includes('efectivo') || lowerName.includes('cash')) {
                type = 'cash';
            } else if (lowerName.includes('tarjeta') || lowerName.includes('crédito') || lowerName.includes('tc')) {
                type = 'credit_card';
            } else if (lowerName.includes('nequi') || lowerName.includes('daviplata')) {
                type = 'savings';
            }

            await AccountDBService.createAccount(user.user_id, {
                name: name,
                type: type,
                balance: balance,
                isDefault: createdAccounts.length === 0
            });

            // Formatear saldo para el mensaje
            const formattedBalance = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(balance);
            createdAccounts.push(`${name} (${formattedBalance})`);
        }

        // Finalizar onboarding
        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'completed',
            onboarding_completed: true
        });

        return `¡Perfecto! He creado las siguientes cuentas:\n• ${createdAccounts.join('\n• ')}\n\n¡Ya estamos listos! 🚀\n\nPuedes empezar diciéndome cosas como:\n- "Registrar gasto de $20.000 en comida"\n- "Ingreso de $1.000.000 salario"\n- "¿Cómo van mis finanzas?"\n\n¿Qué quieres hacer primero? 💜`;
    }
}

module.exports = new OnboardingService();
