const { Pool } = require('pg');
require('dotenv').config();

// Configuración DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Servicios
const MessageService = require('../src/services/message.service');
const AdminService = require('../src/services/admin.service');
const UserDBService = require('../src/services/db/user.db.service');
const Logger = require('../src/utils/logger');

// Usuario de prueba
const TEST_PHONE = '+573009998877';
const ADMIN_PHONE = process.env.ADMIN_PHONE_NUMBER || '+573218372110';

async function logInteraction(speaker, text) {
    console.log(`${speaker}: ${text}`);
}

async function resetUser() {
    Logger.info('🔄 Reseteando usuario de prueba...');
    await pool.query('DELETE FROM users WHERE phone_number = $1', [TEST_PHONE]);
}

async function simulate() {
    try {
        await resetUser();

        Logger.info('🧪 TEST 1: Validación de Nombre Reservado');

        // 1. Inicio
        await logInteraction('User', 'Hola');
        let response = await MessageService.processMessage('Hola', TEST_PHONE, TEST_PHONE);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 2. Intentar nombre inválido
        await logInteraction('User', 'System Info');
        response = await MessageService.processMessage('System Info', TEST_PHONE, TEST_PHONE);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        if (!response.includes('robótico')) {
            throw new Error('❌ Falló validación de nombre reservado');
        }
        Logger.success('✅ Nombre reservado bloqueado correctamente.');

        // 3. Nombre válido
        await logInteraction('User', 'Sebas');
        response = await MessageService.processMessage('Sebas', TEST_PHONE, TEST_PHONE);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        if (!response.includes('Estoy aquí para')) {
            throw new Error('❌ Falló validación de copia refinada (Estoy aquí para...)');
        }
        Logger.success('✅ Copia refinada aceptada.');

        Logger.info('🧪 TEST 2: Alias de Admin');

        // 4. Admin Command "System Info"
        await logInteraction('Admin', 'System Info');
        const adminResponse = await AdminService.handleCommand('system info', ADMIN_PHONE);
        console.log('Admin Response:', adminResponse);

        if (!adminResponse || !adminResponse.includes('Phill System Status')) {
            throw new Error('❌ Falló alias de admin "system info"');
        }
        Logger.success('✅ Alias de admin funcionando.');

        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en simulación:', error);
        process.exit(1);
    }
}

simulate();
