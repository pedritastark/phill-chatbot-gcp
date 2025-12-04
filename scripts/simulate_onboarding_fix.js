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

        // 3. Nombre válido -> Pasa directo a Privacidad (Skip Challenge)
        await logInteraction('User', 'Sebas');
        response = await MessageService.processMessage('Sebas', TEST_PHONE, TEST_PHONE);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        if (!response.includes('Tu privacidad es sagrada')) {
            throw new Error('❌ Falló transición directa a Privacidad');
        }
        Logger.success('✅ Transición directa a Privacidad exitosa.');

        // 4. Aceptar Privacidad -> Pide Saldos Iniciales (Combined)
        await logInteraction('User', 'Acepto');
        response = await MessageService.processMessage('Acepto', TEST_PHONE, TEST_PHONE);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        if (!response.includes('cuánto dinero tienes hoy') || !response.includes('Efectivo') || !response.includes('Banco')) {
            throw new Error('❌ Falló flujo de aceptación y solicitud de saldos combinados');
        }
        Logger.success('✅ Flujo de aceptación correcto (Solicita saldos combinados).');

        // 5. Enviar Saldos Combinados -> Pide Primer Gasto
        const balanceMsg = "Tengo 50k en efectivo y 2.5m en el banco";
        await logInteraction('User', balanceMsg);
        response = await MessageService.processMessage(balanceMsg, TEST_PHONE, TEST_PHONE);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        if (!response.includes('Patrimonio Inicial') || !response.includes('50.000') || !response.includes('2.500.000')) {
            throw new Error('❌ Falló parsing de saldos combinados');
        }
        Logger.success('✅ Parsing de saldos combinados exitoso.');

        Logger.info('🧪 TEST 2: Alias de Admin');

        // 5. Admin Command "System Info"
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
