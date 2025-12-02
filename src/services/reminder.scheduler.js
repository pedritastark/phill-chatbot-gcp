const cron = require('node-cron');
const twilio = require('twilio');
const { config } = require('../config/environment');
const ReminderDBService = require('./db/reminder.db.service');
const UserDBService = require('./db/user.db.service');
const Logger = require('../utils/logger');

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

        // Tip Semanal (Miércoles 8 PM)
        cron.schedule('0 20 * * 3', async () => {
            await this.sendWeeklyTip();
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
                const nextDate = new Date(reminder.scheduled_at);

                switch (reminder.recurrence_pattern) {
                    case 'daily':
                        nextDate.setDate(nextDate.getDate() + 1);
                        break;
                    case 'weekly':
                        nextDate.setDate(nextDate.getDate() + 7);
                        break;
                    case 'monthly':
                        nextDate.setMonth(nextDate.getMonth() + 1);
                        break;
                    case 'yearly':
                        nextDate.setFullYear(nextDate.getFullYear() + 1);
                        break;
                }

                await ReminderDBService.createReminder({
                    userId: reminder.user_id,
                    message: reminder.message,
                    scheduledAt: nextDate.toISOString(),
                    isRecurring: true,
                    recurrencePattern: reminder.recurrence_pattern
                });

                Logger.info(`🔄 Recordatorio recurrente reprogramado para: ${nextDate.toISOString()}`);
            }

        } catch (error) {
            Logger.error(`❌ Error al enviar recordatorio ${reminder.reminder_id}`, error);
            await ReminderDBService.markAsFailed(reminder.reminder_id);
        }
    }

    /**
     * Envía el tip semanal a todos los usuarios
     */
    async sendWeeklyTip() {
        try {
            Logger.info('📢 Iniciando envío de Tip Semanal...');
            const users = await UserDBService.getAllUsers(1000); // Límite alto para MVP

            const tipMessage = `¡Feliz miércoles! Mitad de semana. 🔥\n\n💡 *Phill Hack*: Si estás en el metro o en una cena y quieres registrar un gasto sin que nadie vea tu saldo en la pantalla, activa el Modo Ninja.\n\nSolo escribe: 'Discreto' o manda un emoji de ninja 🥷 y yo me encargo del resto. ¡Pruébalo! 😉 💜`;

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
            Logger.success(`✅ Tip semanal enviado a ${count} usuarios.`);
        } catch (error) {
            Logger.error('Error general enviando tip semanal', error);
        }
    }
}

module.exports = new ReminderScheduler();
