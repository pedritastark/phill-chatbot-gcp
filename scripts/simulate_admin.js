const MessageService = require('../src/services/message.service');
const Logger = require('../src/utils/logger');
require('dotenv').config();

const ADMIN_PHONE = '+573218372110';
const USER_PHONE = '+573001234567';

async function logInteraction(speaker, text) {
    console.log(`${speaker}: ${text}`);
}

async function simulate() {
    try {
        Logger.info('🕵️‍♂️ Iniciando simulación de Admin Mode...');

        // 1. Prueba Admin
        Logger.info('\n--- PRUEBA ADMIN ---');
        await logInteraction('Admin', 'System Status');
        let response = await MessageService.processMessage('System Status', ADMIN_PHONE, 'Admin');
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // 2. Prueba Usuario Normal
        Logger.info('\n--- PRUEBA USUARIO NORMAL ---');
        await logInteraction('User', 'System Status');
        response = await MessageService.processMessage('System Status', USER_PHONE, 'User');
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // Verificar que NO sea el reporte de status (debería ser respuesta normal o onboarding)
        if (response && response.includes && response.includes('Uptime')) {
            Logger.error('❌ FALLO DE SEGURIDAD: Usuario normal vio el status.');
        } else {
            Logger.success('✅ Seguridad OK: Usuario normal no vio el status.');
        }

        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en simulación:', error);
        process.exit(1);
    }
}

simulate();
