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
const TEST_PHONE = '+573001234567';
const TEST_NAME = 'Tester';

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

        // 1. Inicio
        await logInteraction('User', 'Hola');
        let response = await MessageService.processMessage('Hola', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 2. Prueba de Validación (Input inválido)
        await logInteraction('User', 'No tengo nada'); // "nada" es explicit zero -> 0
        // Espera, "No tengo nada" -> parseAmount -> 0. isExplicitZero -> true.
        // Entonces debería aceptarlo como 0.
        // Probemos algo inválido como "Hola"
        await logInteraction('User', 'Hola');
        response = await MessageService.processMessage('Hola', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 3. Prueba de Slang (Cash)
        await logInteraction('User', '10 barras');
        response = await MessageService.processMessage('10 barras', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 4. Prueba de Banco (Input normal)
        await logInteraction('User', '2.000.000');
        response = await MessageService.processMessage('2.000.000', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 5. Primer Gasto (Slang + Descripción)
        await logInteraction('User', '15 lucas en el almuerzo');
        response = await MessageService.processMessage('15 lucas en el almuerzo', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en simulación:', error);
        process.exit(1);
    }
}

simulate();
