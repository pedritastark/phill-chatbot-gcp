const cron = require('node-cron');
const twilio = require('twilio');
const { config } = require('../config/environment');
const ReminderDBService = require('./db/reminder.db.service');
const UserDBService = require('./db/user.db.service');
const Logger = require('../utils/logger');
const { addMonthsSafe } = require('../utils/dateUtils');

class ReminderScheduler {
    constructor() {
        this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
        this.isRunning = false;
    }

    /**
     * Inicia el planificador de recordatorios
     */
    start() {
        if (this.isRunning) {
            Logger.warning('El planificador de recordatorios ya está corriendo');
            return;
        }

        Logger.info('⏰ Iniciando planificador de recordatorios (Check cada minuto)');

        // Ejecutar cada minuto
        cron.schedule('* * * * *', async () => {
            await this.checkReminders();
        });

        // Tip Diario (8 PM hora Colombia)
        cron.schedule('0 20 * * *', async () => {
            await this.sendDailyTip();
        }, {
            scheduled: true,
            timezone: "America/Bogota"
        });

        this.isRunning = true;
    }

    /**
     * Verifica y envía recordatorios pendientes
     */
    async checkReminders() {
        try {
            const reminders = await ReminderDBService.getDueReminders();

            if (reminders.length > 0) {
                Logger.info(`⏰ Encontrados ${reminders.length} recordatorios pendientes`);

                for (const reminder of reminders) {
                    await this.sendReminder(reminder);
                }
            }
        } catch (error) {
            Logger.error('Error en el ciclo de recordatorios', error);
        }
    }

    /**
     * Envía un recordatorio específico
     * @param {Object} reminder
     */
    async sendReminder(reminder) {
        try {
            Logger.info(`Enviando recordatorio a ${reminder.phone_number}: "${reminder.message}"`);

            // Construir el mensaje
            const messageBody = `🔔 *Recordatorio Phill*\n\n${reminder.message}\n\n💜`;

            // Enviar vía Twilio
            await this.client.messages.create({
                body: messageBody,
                from: config.twilio.phoneNumber,
                to: reminder.phone_number
            });

            // Marcar como enviado
            await ReminderDBService.markAsSent(reminder.reminder_id);
            Logger.success(`✅ Recordatorio enviado a ${reminder.phone_number}`);

            // Si es recurrente, programar el siguiente
            if (reminder.is_recurring) {
                let nextDate;
                const currentDate = new Date(reminder.scheduled_at);

                switch (reminder.recurrence_pattern) {
                    case 'daily':
                        nextDate = new Date(currentDate);
                        nextDate.setDate(nextDate.getDate() + 1);
                        break;
                    case 'weekly':
                        nextDate = new Date(currentDate);
                        nextDate.setDate(nextDate.getDate() + 7);
                        break;
                    case 'monthly':
                        // Use safe month addition to handle February edge cases
                        nextDate = addMonthsSafe(currentDate, 1);
                        break;
                    case 'yearly':
                        nextDate = new Date(currentDate);
                        nextDate.setFullYear(nextDate.getFullYear() + 1);
                        break;
                }

                await ReminderDBService.createReminder({
                    userId: reminder.user_id,
                    message: reminder.message,
                    scheduledAt: nextDate.toISOString(),
                    isRecurring: true,
                    recurrencePattern: reminder.recurrence_pattern,
                    amount: reminder.amount,
                    currency: reminder.currency,
                    accountName: reminder.account_name,
                    accountId: reminder.account_id,
                    transactionType: reminder.transaction_type,
                    completionStatus: 'pending',
                    status: 'pending'
                });

                Logger.info(`🔄 Recordatorio recurrente reprogramado para: ${nextDate.toISOString()}`);
            }

        } catch (error) {
            Logger.error(`❌ Error al enviar recordatorio ${reminder.reminder_id}`, error);
            await ReminderDBService.markAsFailed(reminder.reminder_id);
        }
    }

    /**
     * Envía el tip diario a todos los usuarios
     */
    async sendDailyTip() {
        try {
            Logger.info('📢 Iniciando envío de Tip Diario...');
            const users = await UserDBService.getAllUsers(1000); // Límite alto para MVP

            // TODO: Hacer esto dinámico con IA o una lista de tips
            const tips = [
                "💡 *Phill Hack*: Si estás en el metro o en una cena y quieres registrar un gasto sin que nadie vea tu saldo en la pantalla, activa el Modo Ninja. Solo escribe: 'Discreto' o manda un emoji de ninja 🥷.",
                "💡 *Phill Tip*: Revisar tus gastos diarios toma menos de 1 minuto y te ahorra dolores de cabeza a fin de mes.",
                "💡 *Sabías que...* Pequeños gastos hormiga pueden sumar hasta el 15% de tu sueldo. ¡Ojo con el café de todos los dias! ☕",
                "💡 *Reto Phill*: Intenta pasar el día de mañana sin gastos innecesarios. ¿Te atreves? 🚫💸",
                "💡 *Inversión*: No necesitas ser millonario para invertir. Empezar con poco es mejor que no empezar."
            ];

            // Seleccionar tip aleatorio
            const randomTip = tips[Math.floor(Math.random() * tips.length)];
            const tipMessage = `¡Hola! Tu dosis diaria de sabiduría financiera. 🧠\n\n${randomTip}\n\n💜`;

            let count = 0;
            for (const user of users) {
                try {
                    await this.client.messages.create({
                        body: tipMessage,
                        from: config.twilio.phoneNumber,
                        to: user.phone_number
                    });
                    count++;
                    // Pequeña pausa para no saturar la API (rate limiting básico)
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (err) {
                    Logger.error(`Error enviando tip a ${user.phone_number}`, err);
                }
            }
            Logger.success(`✅ Tip diario enviado a ${count} usuarios.`);
        } catch (error) {
            Logger.error('Error general enviando tip diario', error);
        }
    }
}

module.exports = new ReminderScheduler();
