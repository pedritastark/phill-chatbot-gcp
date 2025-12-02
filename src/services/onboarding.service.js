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
            const user = await UserDBService.findByPhoneNumber(userId);

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
    async handleNameStep(user, nameInput) {
        let name = nameInput.trim();

        // Limpiar frases comunes
        const prefixes = [
            /^me llamo\s+/i,
            /^mi nombre es\s+/i,
            /^soy\s+/i,
            /^me dicen\s+/i,
            /^yo soy\s+/i
        ];

        for (const prefix of prefixes) {
            name = name.replace(prefix, '');
        }

        // Capitalizar primera letra
        name = name.charAt(0).toUpperCase() + name.slice(1);

        if (name.length < 2) {
            return "Ese nombre es muy corto. ¿Cómo te llamas realmente? 😊";
        }

        // Guardar nombre
        await UserDBService.updateUser(user.phone_number, {
            name: name,
            onboarding_step: 'accounts'
        });

        return `¡Un gusto conocerte, ${name}! 💜\n\nPara organizar tus finanzas, vamos a empezar simple. Necesito saber cuánto dinero tienes en **Efectivo** y en tu **Banco**.\n\nPor favor responde con los saldos de cada uno.\n\nEjemplo:\n"Efectivo: 50.000, Banco: 200.000"`;
    }

    /**
     * Maneja el paso de cuentas
     */
    async handleAccountsStep(user, accountsStr) {
        // Separar por comas o saltos de línea
        const accountsRaw = accountsStr.split(/[,;\n]+/).map(a => a.trim()).filter(a => a.length > 0);

        // Validación estricta: Debe haber al menos un número en el mensaje
        if (!/\d/.test(accountsStr)) {
            return "Hmm, no veo ningún saldo en tu mensaje. 🤔\n\nPor favor escribe cuánto tienes en Efectivo y en Banco.\n\nEjemplo: \"Efectivo: 50.000, Banco: 200.000\"";
        }

        let cashBalance = 0;
        let bankBalance = 0;
        let foundCash = false;
        let foundBank = false;

        // Intentar parsear explícitamente
        for (const raw of accountsRaw) {
            const match = raw.match(/^(.+?)(?:[:\s\$]+)([\d\.,]+)$/);
            if (match) {
                const name = match[1].toLowerCase();
                let amountStr = match[2].replace(/\./g, '').replace(',', '.');
                let amount = parseFloat(amountStr) || 0;

                if (name.includes('efectivo') || name.includes('cash')) {
                    cashBalance = amount;
                    foundCash = true;
                } else if (name.includes('banco') || name.includes('bank') || name.includes('cuenta') || name.includes('nequi') || name.includes('daviplata')) {
                    // Asumimos que cualquier otra cosa parecida a banco o cuenta va al "Banco" genérico
                    bankBalance = amount;
                    foundBank = true;
                }
            }
        }

        // Si no se encontraron explícitamente pero hay 2 números, asumimos orden: Efectivo, Banco
        if (!foundCash && !foundBank) {
            const numbers = accountsStr.match(/[\d\.,]+/g);
            if (numbers && numbers.length >= 2) {
                cashBalance = parseFloat(numbers[0].replace(/\./g, '').replace(',', '.')) || 0;
                bankBalance = parseFloat(numbers[1].replace(/\./g, '').replace(',', '.')) || 0;
                foundCash = true;
                foundBank = true;
            }
        }

        // Si aún falta información, pedir aclaración o asumir 0 si al menos uno se encontró
        if (!foundCash && !foundBank) {
            return "No pude entender los saldos. 😅\n\nPor favor intenta escribirlos así:\n\"Efectivo: 50.000, Banco: 100.000\"";
        }

        // Crear cuentas fijas
        const createdAccounts = [];

        // 1. Efectivo
        await AccountDBService.create({
            userId: user.user_id,
            name: 'Efectivo',
            type: 'cash',
            balance: cashBalance,
            isDefault: true,
            icon: '💵',
            color: '#10b981'
        });
        createdAccounts.push(`Efectivo (${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(cashBalance)})`);

        // 2. Banco
        await AccountDBService.create({
            userId: user.user_id,
            name: 'Banco',
            type: 'savings',
            balance: bankBalance,
            isDefault: false,
            icon: '🏦',
            color: '#3b82f6'
        });
        createdAccounts.push(`Banco (${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(bankBalance)})`);

        // Finalizar onboarding
        await UserDBService.updateUser(user.phone_number, {
            onboarding_step: 'completed',
            onboarding_completed: true
        });

        return `¡Perfecto! He creado las siguientes cuentas:\n• ${createdAccounts.join('\n• ')}\n\n¡Ya estamos listos! 🚀\n\nPuedes empezar diciéndome cosas como:\n- "Registrar gasto de $20.000 en comida"\n- "Ingreso de $1.000.000 salario"\n- "¿Cómo van mis finanzas?"\n\n¿Qué quieres hacer primero? 💜`;
    }
}

module.exports = new OnboardingService();
