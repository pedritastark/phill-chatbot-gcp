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
const TEST_NAME = 'ButtonTester';

async function logInteraction(speaker, content) {
    if (typeof content === 'object') {
        let msg = `${speaker}: ${content.message}`;
        if (content.buttons) {
            msg += `\n   [Buttons: ${content.buttons.map(b => b.title).join(' | ')}]`;
        }
        console.log(msg);
    } else {
        console.log(`${speaker}: ${content}`);
    }
}

async function resetUser() {
    Logger.info('🔄 Reseteando usuario de prueba...');
    await pool.query('DELETE FROM transactions WHERE user_id IN (SELECT user_id FROM users WHERE phone_number = $1)', [TEST_PHONE]);
    await pool.query('DELETE FROM reminders WHERE user_id IN (SELECT user_id FROM users WHERE phone_number = $1)', [TEST_PHONE]);
    await pool.query('DELETE FROM accounts WHERE user_id IN (SELECT user_id FROM users WHERE phone_number = $1)', [TEST_PHONE]);
    await pool.query('DELETE FROM users WHERE phone_number = $1', [TEST_PHONE]);
    Logger.success('✅ Usuario reseteado.');
}

async function simulate() {
    try {
        await resetUser();

        // 1. Inicio (Debería pedir nombre)
        await logInteraction('User', 'Hola');
        let response = await MessageService.processMessage('Hola', TEST_PHONE);
        await logInteraction('Phill', response);

        // 2. Dar Nombre (Debería devolver botones de Acepto)
        await logInteraction('User', TEST_NAME);
        response = await MessageService.processMessage(TEST_NAME, TEST_PHONE);
        await logInteraction('Phill', response);

        if (!response.buttons || response.buttons[0].id !== 'accept') {
            throw new Error('❌ Falló: No se recibieron botones de aceptación');
        }

        // 3. Aceptar Términos (Simulando texto de botón)
        await logInteraction('User', 'Acepto');
        response = await MessageService.processMessage('Acepto', TEST_PHONE);
        await logInteraction('Phill', response);

        // 4. Saldos Iniciales (Texto libre)
        await logInteraction('User', 'Efectivo: 100k, Banco: 500k');
        response = await MessageService.processMessage('Efectivo: 100k, Banco: 500k', TEST_PHONE);
        await logInteraction('Phill', response);

        // 5. Primer Gasto (Texto libre)
        await logInteraction('User', 'Gasté 20k en Uber');
        response = await MessageService.processMessage('Gasté 20k en Uber', TEST_PHONE);
        await logInteraction('Phill', response);

        if (!response.buttons) {
            throw new Error('❌ Falló: No se recibieron botones de selección de cuenta');
        }

        // 6. Selección de Cuenta (Usando palabra clave del botón "Banco")
        await logInteraction('User', 'Banco');
        response = await MessageService.processMessage('Banco', TEST_PHONE);
        await logInteraction('Phill', response);

        if (!response.buttons) { // Check reminder buttons
            throw new Error('❌ Falló: No se recibieron botones de recordatorio');
        }

        // 7. Aceptar Recordatorio
        await logInteraction('User', '¡De una!');
        response = await MessageService.processMessage('¡De una!', TEST_PHONE);
        await logInteraction('Phill', response);

        Logger.success('✅ Simulación completada exitosamente.');
        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en simulación:', error);
        process.exit(1);
    }
}

simulate();
