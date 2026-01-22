require('dotenv').config();
const SchedulerService = require('../src/services/scheduler.service');
const { closePool } = require('../src/config/database');
const Logger = require('../src/utils/logger');

async function triggerNow() {
    console.log('🚀 Disparando checkDailyReminders manualmente...');

    try {
        await SchedulerService.checkDailyReminders();
        console.log('🏁 Ejecución finalizada.');
    } catch (error) {
        console.error('❌ Error ejecutando trigger:', error);
    } finally {
        // Necesario para que el script termine si hay piscina DB abierta
        await closePool();
    }
}

triggerNow();
