const cron = require('node-cron');
const twilio = require('twilio');
const { config } = require('../config/environment');
const ReminderDBService = require('./db/reminder.db.service');
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
}

module.exports = new ReminderScheduler();
