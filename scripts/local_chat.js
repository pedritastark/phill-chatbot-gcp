require('dotenv').config();
const readline = require('readline');
const MessageService = require('../src/services/message.service');
const { closePool } = require('../src/config/database');

// Configuración
const TEST_PHONE_NUMBER = 'whatsapp:+573000000000'; // Número de prueba
const USER_NAME = 'Tester Local';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🤖 Bienvenido al Chat Local de Phill');
console.log('-----------------------------------');
console.log(`📱 Usando número de prueba: ${TEST_PHONE_NUMBER}`);
console.log('📝 Escribe tus mensajes. Presiona Ctrl+C para salir.');
console.log('-----------------------------------');

async function startChat() {
    try {
        // Inicializar servicio
        await MessageService.initialize();

        // Iniciar planificador de recordatorios
        const ReminderScheduler = require('../src/services/reminder.scheduler');
        ReminderScheduler.start();

        // Prompt inicial
        process.stdout.write('\nTu: ');

        rl.on('line', async (input) => {
            const message = input.trim();

            if (message) {
                try {
                    // Mostrar indicador de "escribiendo"
                    process.stdout.write('Phill: Escribiendo...\r');

                    // Procesar mensaje
                    const response = await MessageService.processMessage(message, TEST_PHONE_NUMBER);

                    // Limpiar línea de "escribiendo" y mostrar respuesta
                    process.stdout.write('                                  \r'); // Borrar línea
                    console.log(`Phill: ${response}`);

                } catch (error) {
                    console.error('\n❌ Error:', error.message);
                }
            }

            // Siguiente prompt
            process.stdout.write('\nTu: ');
        });

        rl.on('close', async () => {
            console.log('\n\n👋 Cerrando chat...');
            await closePool();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error fatal al iniciar:', error);
        await closePool();
        process.exit(1);
    }
}

startChat();
