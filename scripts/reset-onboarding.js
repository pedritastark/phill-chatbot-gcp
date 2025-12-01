require('dotenv').config();
const { pool } = require('../src/config/database');
const Logger = require('../src/utils/logger');

const PHONE_NUMBER = process.argv[2];

if (!PHONE_NUMBER) {
    console.error('Por favor proporciona un número de teléfono. Ejemplo: node scripts/reset-onboarding.js whatsapp:+573001234567');
    process.exit(1);
}

async function resetOnboarding() {
    try {
        Logger.info(`🔄 Reseteando onboarding para ${PHONE_NUMBER}...`);

        // 1. Resetear flags de usuario
        await pool.query(
            `UPDATE users 
       SET onboarding_step = 'name', 
           onboarding_completed = false,
           name = NULL
       WHERE phone_number = $1`,
            [PHONE_NUMBER]
        );

        // 2. Eliminar cuentas (opcional, para empezar de cero)
        await pool.query(
            `DELETE FROM accounts WHERE user_id = (SELECT user_id FROM users WHERE phone_number = $1)`,
            [PHONE_NUMBER]
        );

        Logger.success('✅ Onboarding reseteado exitosamente.');
        Logger.info('Envía cualquier mensaje al bot para iniciar de nuevo.');
        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error al resetear onboarding', error);
        process.exit(1);
    }
}

resetOnboarding();
