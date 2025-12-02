const { Pool } = require('pg');
require('dotenv').config();

// Configuración DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Servicios
const MessageService = require('../src/services/message.service');
const Logger = require('../src/utils/logger');

// Usuario de prueba
const TEST_PHONE = '+573004443322';
const TEST_NAME = 'PrivacyUser';

async function logInteraction(speaker, text) {
    console.log(`${speaker}: ${text}`);
}

async function resetUser() {
    Logger.info('🔄 Reseteando usuario de prueba...');
    await pool.query('DELETE FROM transactions WHERE user_id IN (SELECT user_id FROM users WHERE phone_number = $1)', [TEST_PHONE]);
    await pool.query('DELETE FROM accounts WHERE user_id IN (SELECT user_id FROM users WHERE phone_number = $1)', [TEST_PHONE]);
    await pool.query('DELETE FROM users WHERE phone_number = $1', [TEST_PHONE]);
    Logger.success('✅ Usuario reseteado.');
}

async function simulate() {
    try {
        await resetUser();

        // 1. Inicio (Pide Nombre)
        await logInteraction('User', 'Hola');
        let response = await MessageService.processMessage('Hola', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 2. Dar Nombre (Debería lanzar el Reto)
        await logInteraction('User', 'Sebas');
        response = await MessageService.processMessage('Sebas', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 3. Pregunta Reto (Debería responder con IA + Pedir Consentimiento)
        await logInteraction('User', '¿Qué es inflación?');
        response = await MessageService.processMessage('¿Qué es inflación?', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 4. Aceptar Consentimiento (Debería pedir dinero)
        await logInteraction('User', 'Acepto');
        response = await MessageService.processMessage('Acepto', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 5. Dar Efectivo (Debería aceptarlo)
        await logInteraction('User', '100k');
        response = await MessageService.processMessage('100k', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en simulación:', error);
        process.exit(1);
    }
}

simulate();
