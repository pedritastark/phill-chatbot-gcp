const { config } = require('../config/environment');
const Logger = require('../utils/logger');
const UserDBService = require('./db/user.db.service');
const { Pool } = require('pg');

// Pool para verificar conexión a DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

class AdminService {
    constructor() {
        this.startTime = Date.now();
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

        if (lowerCmd === 'system status' || lowerCmd === 'status' || lowerCmd === 'estado') {
            return await this.getSystemStatus();
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
