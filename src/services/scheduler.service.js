const cron = require('node-cron');
const { DateTime } = require('luxon');
const Logger = require('../utils/logger');
const { TransactionDBService } = require('./db');
// Aquí importaremos WhatsAppService más adelante
// const WhatsAppService = require('./whatsapp.service');

class SchedulerService {
    constructor() {
        this.cronTask = null;
    }

    /**
     * Inicializa el cron job
     */
    init() {
        Logger.info('⏳ Inicializando Scheduler Service...');

        // Ejecutar todos los días a las 8:00 AM hora Bogotá
        // Cron sintaxis: 0 8 * * *
        this.cronTask = cron.schedule('0 8 * * *', async () => {
            Logger.info('⏰ Ejecutando cron de recordatorios diarios...');
            await this.checkDailyReminders();
        }, {
            scheduled: true,
            timezone: "America/Bogota"
        });

        Logger.success('✅ Scheduler activo: 8:00 AM (America/Bogota) daily.');
    }

    /**
     * Procesa las transacciones pendientes vencidas o del día
     */
    async checkDailyReminders() {
        try {
            const today = DateTime.now().setZone('America/Bogota').toFormat('yyyy-MM-dd');

            // Buscar todas las pendientes hasta hoy (incluye atrasadas)
            const pendings = await TransactionDBService.getPendingDue(today);

            if (pendings.length === 0) {
                Logger.info('✅ No hay recordatorios pendientes para hoy.');
                return;
            }

            Logger.info(`🔔 ${pendings.length} transacciones pendientes encontradas.`);

            // Agrupar por usuario
            const pendingsByUser = pendings.reduce((acc, curr) => {
                if (!acc[curr.user_id]) {
                    acc[curr.user_id] = {
                        phoneNumber: curr.phone_number,
                        items: []
                    };
                }
                acc[curr.user_id].items.push(curr);
                return acc;
            }, {});

            // Enviar notificaciones (Mocabos)
            for (const userId in pendingsByUser) {
                const { phoneNumber, items } = pendingsByUser[userId];
                await this.sendDailyReminder(phoneNumber, items);
            }

        } catch (error) {
            Logger.error('❌ Error procesando recordatorios del cron', error);
        }
    }

    /**
     * Simula el envío de recordatorio (Mock de WhatsApp)
     */
    async sendDailyReminder(phoneNumber, transactions) {
        try {
            // Construir mensaje
            const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
            const currency = transactions[0].currency || 'COP'; // Asumimos misma moneda por ahora o default

            let message = `🔔 *Recordatorio Phill*\n\nHoy tienes ${transactions.length} pagos pendientes por un total de $${totalAmount} ${currency}:\n`;

            transactions.forEach(t => {
                message += `- ${t.description}: $${t.amount}\n`;
            });

            message += `\n¿Ya los pagaste? Responde "Ya pagué [Descripción]" para actualizarlos.`;

            // Simulación de envío
            this.mockSendNotification(phoneNumber, message);
        } catch (error) {
            Logger.error(`Error enviando recordatorio a ${phoneNumber}`, error);
        }
    }

    mockSendNotification(to, message) {
        console.log('\n========================================');
        console.log(`📱 [WHATSAPP MOCK] To: ${to}`);
        console.log('----------------------------------------');
        console.log(message);
        console.log('========================================\n');
    }
}

module.exports = new SchedulerService();
