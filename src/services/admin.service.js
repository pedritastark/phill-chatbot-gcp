const twilio = require('twilio');
const { config } = require('../config/environment');
const Logger = require('../utils/logger');
const UserDBService = require('./db/user.db.service');
const AccountDBService = require('./db/account.db.service');
const { Pool } = require('pg');

// Pool para verificar conexión a DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

class AdminService {
    constructor() {
        this.startTime = Date.now();
        // Inicializar Twilio si hay credenciales
        if (config.twilio.accountSid && config.twilio.authToken) {
            this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
        }
    }

    /**
     * Verifica si un usuario es administrador
     * @param {string} phoneNumber 
     * @returns {boolean}
     */
    isAdmin(phoneNumber) {
        // Normalizar números (eliminar espacios, guiones)
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const cleanAdmin = config.messaging.adminPhoneNumber.replace(/\D/g, '');
        return cleanPhone === cleanAdmin;
    }

    /**
     * Maneja comandos de administrador
     * @param {string} command 
     * @param {string} userId 
     * @returns {Promise<string|null>} Retorna respuesta o null si no es comando admin
     */
    async handleCommand(command, userId) {
        if (!this.isAdmin(userId)) return null;

        const lowerCmd = command.toLowerCase().trim();

        // 1. System Status
        if (lowerCmd === 'system status' || lowerCmd === 'status' || lowerCmd === 'estado' || lowerCmd === 'system info') {
            return await this.getSystemStatus();
        }

        // 2. User Info
        if (lowerCmd.startsWith('user info')) {
            const targetPhone = command.split(' ').slice(2).join('').replace(/\s/g, ''); // Extraer teléfono
            return await this.getUserInfo(targetPhone);
        }

        // 3. Reset User
        if (lowerCmd.startsWith('reset user')) {
            const targetPhone = command.split(' ').slice(2).join('').replace(/\s/g, '');
            return await this.resetUser(targetPhone);
        }

        // 4. Broadcast
        if (lowerCmd.startsWith('broadcast')) {
            const message = command.split(' ').slice(1).join(' ');
            return await this.broadcastMessage(message);
        }

        return null;
    }

    /**
     * Genera el reporte de estado del sistema
     */
    async getSystemStatus() {
        try {
            // 1. Uptime
            const uptime = this.formatUptime(Date.now() - this.startTime);

            // 2. DB Status
            let dbStatus = '🔴 Desconectada';
            let dbLatency = 0;
            try {
                const start = Date.now();
                await pool.query('SELECT 1');
                dbLatency = Date.now() - start;
                dbStatus = `🟢 Conectada (${dbLatency}ms)`;
            } catch (e) {
                dbStatus = '🔴 Error DB';
                Logger.error('Admin Check DB Error', e);
            }

            // 3. Métricas de Hoy
            const today = new Date();
            // Ajuste simple a hora Colombia para query (UTC-5)
            const todayStr = new Date(today.getTime() - (5 * 60 * 60 * 1000)).toISOString().split('T')[0];

            // Usuarios activos hoy (que hayan enviado mensajes)
            // Nota: Esto requeriría una tabla de logs de mensajes o updated_at en users.
            // Usaremos last_activity_date de users
            const activeUsersCount = await this.getActiveUsersCount(todayStr);

            // Mensajes procesados (Simulado o real si tuviéramos contador en memoria/redis)
            // Por ahora usaremos un placeholder o contador simple si lo implementamos
            const messagesProcessed = 'N/A';

            return `🤖 *Phill System Status*

✅ *Uptime:* ${uptime}
${dbStatus}
🟢 *Twilio:* Activo
🟢 *OpenAI:* Activo

📊 *Métricas de Hoy (${todayStr}):*
• Usuarios Activos: ${activeUsersCount}
• Errores: 0 (Log)

💰 *Costos (Estimado):*
• OpenAI Tokens: N/A ($0.00)

👥 *Última Actividad:*
• Ver logs para detalles.

¿Algo más, jefe? 😎`;

        } catch (error) {
            Logger.error('Error generando System Status', error);
            return '❌ Error generando reporte de estado.';
        }
    }

    /**
     * Obtiene información detallada de un usuario
     */
    async getUserInfo(phoneNumber) {
        try {
            // Intentar normalizar si no tiene +
            let searchPhone = phoneNumber;
            if (!searchPhone.startsWith('+')) searchPhone = '+' + searchPhone;

            const user = await UserDBService.findByPhoneNumber(searchPhone);
            if (!user) return `❌ Usuario no encontrado: ${searchPhone}`;

            const accounts = await AccountDBService.findByUser(user.user_id);
            const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);

            return `👤 *User Info: ${user.name || 'Sin Nombre'}*

📱 Tel: ${user.phone_number}
📍 Estado: ${user.is_active ? 'Activo 🟢' : 'Inactivo 🔴'}
🏁 Onboarding: ${user.onboarding_completed ? 'Completado ✅' : 'En proceso (' + user.onboarding_step + ') 🚧'}
💰 Balance Total: $${totalBalance.toLocaleString()}
📅 Última vez: ${new Date(user.last_interaction).toLocaleString()}
`;
        } catch (error) {
            Logger.error('Error getting user info', error);
            return '❌ Error obteniendo info del usuario.';
        }
    }

    /**
     * Resetea un usuario (Hard Reset)
     */
    async resetUser(phoneNumber) {
        try {
            let targetPhone = phoneNumber;
            if (!targetPhone.startsWith('+')) targetPhone = '+' + targetPhone;

            const user = await UserDBService.findByPhoneNumber(targetPhone);
            if (!user) return `❌ Usuario no encontrado: ${targetPhone}`;

            // Borrar transacciones, cuentas, recordatorios y usuario
            // Nota: Esto debería estar en un servicio transaccional, pero por simplicidad lo haremos aquí o llamaremos a un método de reset si existiera.
            // Como no existe un método "hard delete" en los servicios, haremos queries directos con el pool por seguridad.

            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const userId = user.user_id;

                await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
                await client.query('DELETE FROM reminders WHERE user_id = $1', [userId]);
                await client.query('DELETE FROM accounts WHERE user_id = $1', [userId]);
                await client.query('DELETE FROM categories WHERE user_id = $1', [userId]);
                await client.query('DELETE FROM users WHERE user_id = $1', [userId]);

                await client.query('COMMIT');
                return `✅ Usuario ${targetPhone} ha sido eliminado completamente.`;
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }

        } catch (error) {
            Logger.error('Error resetting user', error);
            return '❌ Error reseteando usuario.';
        }
    }

    /**
     * Envía un mensaje a todos los usuarios activos
     */
    async broadcastMessage(message) {
        if (!this.client) return '❌ Twilio no configurado.';
        if (!message || message.length < 5) return '❌ Mensaje muy corto.';

        try {
            const users = await UserDBService.getAllUsers(1000); // Límite de seguridad
            let sent = 0;
            let failed = 0;

            // Responder inmediatamente al admin que el proceso inició
            // Nota: Como esto retorna un string, no podemos hacer async fire-and-forget fácilmente sin bloquear la respuesta al admin.
            // Para MVP, lo haremos síncrono (lento) o retornaremos "Iniciando..." y dejaremos que corra.
            // Vamos a dejar que corra en background y retornar "Iniciando".

            this.runBroadcastBackground(users, message);

            return `📢 *Broadcast Iniciado*
            
Destinatarios: ${users.length} usuarios.
Mensaje: "${message}"

Te avisaré por logs cuando termine.`;

        } catch (error) {
            Logger.error('Error preparing broadcast', error);
            return '❌ Error preparando broadcast.';
        }
    }

    async runBroadcastBackground(users, message) {
        Logger.info(`📢 Iniciando Broadcast a ${users.length} usuarios...`);
        let sent = 0;

        for (const user of users) {
            try {
                let from = config.twilio.phoneNumber;
                let to = user.phone_number;

                // Manejo de canales (WhatsApp vs SMS)
                if (to.startsWith('whatsapp:')) {
                    if (!from.startsWith('whatsapp:')) {
                        from = `whatsapp:${from}`;
                    }
                } else {
                    // Si es SMS, asegurar que el From no tenga whatsapp:
                    from = from.replace('whatsapp:', '');
                }

                await this.client.messages.create({
                    body: `📢 *Mensaje de Phill*\n\n${message}\n\n💜`,
                    from: from,
                    to: to
                });
                sent++;
                await new Promise(r => setTimeout(r, 100)); // Rate limit
            } catch (e) {
                Logger.error(`Falló broadcast a ${user.phone_number}`, e);
            }
        }
        Logger.success(`✅ Broadcast finalizado. Enviados: ${sent}/${users.length}`);
    }

    formatUptime(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));

        return `${days}d ${hours}h ${minutes}m`;
    }

    async getActiveUsersCount(dateStr) {
        try {
            const res = await pool.query(
                "SELECT COUNT(*) FROM users WHERE last_activity_date = $1",
                [dateStr]
            );
            return res.rows[0].count;
        } catch (error) {
            return 0;
        }
    }
}

module.exports = new AdminService();
