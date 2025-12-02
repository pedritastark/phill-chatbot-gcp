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
const TEST_PHONE = '+573009998877';
const TEST_NAME = 'NewUser';

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

        // 1. Inicio (Debería pedir nombre)
        await logInteraction('User', 'Hola');
        let response = await MessageService.processMessage('Hola', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 2. Dar Nombre
        await logInteraction('User', 'Sebas');
        response = await MessageService.processMessage('Sebas', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 3. Dar Efectivo (Debería aceptarlo)
        await logInteraction('User', '50k');
        response = await MessageService.processMessage('50k', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en simulación:', error);
        process.exit(1);
    }
}

simulate();
