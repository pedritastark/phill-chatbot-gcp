require('dotenv').config();
// Sanitize corrupted env var if present
// Force clean up and sync env vars
if (process.env.DB_USER) {
    process.env.DB_USER = 'postgres'; // Safe default
}

if (process.env.DATABASE_URL) {
    try {
        const url = new URL(process.env.DATABASE_URL);
        process.env.DB_HOST = url.hostname;
        process.env.DB_PORT = url.port;
        process.env.DB_USER = url.username;
        process.env.DB_PASSWORD = url.password;
        process.env.DB_NAME = url.pathname.slice(1); // remove leading slash

        console.log('✅ EXTRACTED DB CONFIG FROM URL:');
        console.log('Host:', process.env.DB_HOST);
        console.log('User:', process.env.DB_USER);
        console.log('Port:', process.env.DB_PORT);
    } catch (err) {
        console.error('Failed to parse DATABASE_URL', err);
    }
}
const { Pool } = require('pg');
const ReminderScheduler = require('../src/services/reminder.scheduler');
const ReminderDBService = require('../src/services/db/reminder.db.service');
const { config } = require('../src/config/environment');

// Conexión DB directa para el test
const pool = new Pool({
    user: process.env.DB_USER || 'user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'phill',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function runTest() {
    try {
        console.log('🧪 Iniciando prueba de recordatorios...');

        // 1. Crear un usuario de prueba (o usar uno existente)
        // Para simplificar, asumiremos que existe algún usuario o crearemos uno dummy
        // Mejor: Insertamos un recordatorio para un user_id hardcodeado temporalmente o buscamos uno.

        // Buscar un usuario existente
        const userResult = await pool.query('SELECT user_id, phone_number FROM users LIMIT 1');
        if (userResult.rows.length === 0) {
            console.error('❌ No hay usuarios en la DB para probar.');
            process.exit(1);
        }

        const user = userResult.rows[0];
        console.log(`👤 Usando usuario de prueba: ${user.phone_number} (${user.user_id})`);

        // 2. Crear un recordatorio para YA MISMO (para que el próximo cron minutal lo coja sí o sí)
        const now = new Date();
        const scheduledAt = new Date(now.getTime() + 1000); // 1 segundo en el futuro

        console.log(`📅 Hora actual: ${now.toString()}`);
        console.log(`📅 Recordatorio programado para: ${scheduledAt.toString()}`);

        const reminder = await ReminderDBService.createReminder({
            userId: user.user_id,
            message: 'Test de recordatorio automático 🤖',
            scheduledAt: scheduledAt.toISOString(),
            isRecurring: false
        });

        console.log(`✅ Recordatorio creado con ID: ${reminder.reminder_id}`);

        // 3. Iniciar el Scheduler
        // Mockeamos el cliente de Twilio para no gastar saldo si no es necesario,
        // o dejamos que falle el envío real pero verifiquemos que INTENTA enviar.
        // Para este test, vamos a dejar que intente enviar real o falle, lo importante es ver el log.

        // Sobrescribir el método sendReminder para no spamear real si se quiere, 
        // pero el usuario pidió "probar si funcionan", así que mejor dejarlo real.
        // Solo monitorearemos los logs.

        console.log('⏰ Iniciando Scheduler...');
        ReminderScheduler.start(); // Esto inicia el cron

        // Forzamos un chequeo inmediato aunque el cron corre cada minuto, 
        // para ver si coge algo (no debería cogerlo AUN porque falta 1 min).
        console.log('🔍 Chequeo inmediato (no debería encontrar nada todavía)...');
        await ReminderScheduler.checkReminders();

        console.log('⏳ Esperando 70 segundos para que el CRON se ejecute y detecte el recordatorio...');

        // Esperar
        setTimeout(async () => {
            console.log('🏁 Tiempo de espera finalizado.');

            // Verificar estado del recordatorio en DB
            const checkResult = await pool.query('SELECT status, sent_at FROM reminders WHERE reminder_id = $1', [reminder.reminder_id]);
            const updatedReminder = checkResult.rows[0];

            console.log('📊 Estado final del recordatorio:', updatedReminder);

            if (updatedReminder.status === 'sent' || updatedReminder.status === 'failed') {
                console.log('✅ El scheduler procesó el recordatorio (éxito o fallo de envío, pero procesado).');
            } else {
                console.log('❌ El scheduler NO procesó el recordatorio (sigue pending).');
            }

            process.exit(0);
        }, 70000);

    } catch (error) {
        console.error('❌ Error en el test:', error);
        process.exit(1);
    }
}

// Ejecutar
runTest();
