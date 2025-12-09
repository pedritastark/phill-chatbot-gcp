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
const TEST_NAME = 'FlexTester';

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
    await pool.query('DELETE FROM users WHERE user_id IN (SELECT user_id FROM users WHERE phone_number = $1)', [TEST_PHONE]);
    // Also delete by phone number directly to be safe if user_id changed
    await pool.query('DELETE FROM users WHERE phone_number = $1', [TEST_PHONE]);

    Logger.success('✅ Usuario reseteado.');
}

async function simulate() {
    try {
        await resetUser();

        // 1. Inicio
        await logInteraction('User', 'Hola');
        await MessageService.processMessage('Hola', TEST_PHONE);

        // 2. Nombre
        await logInteraction('User', TEST_NAME);
        await MessageService.processMessage(TEST_NAME, TEST_PHONE);

        // 3. Aceptar
        await logInteraction('User', 'Acepto');
        await MessageService.processMessage('Acepto', TEST_PHONE);

        // 4. Saldos Flexibles (Debe crear 3 cuentas: Nequi, Bancolombia, Cartera)
        const balancesMsg = 'Tengo 50k en Nequi, 200.000 en Bancolombia y 10.000 en la cartera';
        await logInteraction('User', balancesMsg);
        let response = await MessageService.processMessage(balancesMsg, TEST_PHONE);
        await logInteraction('Phill', response);

        // Validar respuesta de creación de cuentas (No podemos ver DB aquí fácilmente sin query, confiamos en respuesta texto)
        if (!response.includes('Nequi') || !response.includes('Bancolombia') || !response.includes('cartera') && !response.includes('Cartera')) {
            throw new Error('❌ Falló: No se confirmaron las cuentas esperadas en el texto.');
        }

        // 5. Gasto
        await logInteraction('User', 'Gasté 15k en pizza');
        response = await MessageService.processMessage('Gasté 15k en pizza', TEST_PHONE);
        await logInteraction('Phill', response);

        // Validar botones dinámicos
        if (!response.buttons) throw new Error('❌ Falló: No hay botones');
        if (response.buttons.length !== 3) throw new Error(`❌ Falló: Esperaba 3 botones, obtuvo ${response.buttons.length}`);

        // Verificar contenido de botones (deben tener saldo)
        const btnTitles = response.buttons.map(b => b.title);
        console.log('Botones recibidos:', btnTitles);

        if (!btnTitles.some(t => t.includes('Nequi') && t.includes('50.000'))) throw new Error('❌ Falló botón Nequi');
        if (!btnTitles.some(t => t.includes('Bancolombia') && t.includes('200.000'))) throw new Error('❌ Falló botón Bancolombia');

        // 6. Selección (Usar Nequi)
        await logInteraction('User', 'Nequi');
        response = await MessageService.processMessage('Nequi', TEST_PHONE);
        await logInteraction('Phill', response);

        // 7. Cierre
        await logInteraction('User', 'Listo');
        response = await MessageService.processMessage('Listo', TEST_PHONE);
        await logInteraction('Phill', response);

        Logger.success('✅ Simulación Flexible completada exitosamente.');
        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en simulación:', error);
        process.exit(1);
    }
}

simulate();
