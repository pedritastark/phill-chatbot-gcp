require('dotenv').config();
const { UserDBService, AccountDBService } = require('../src/services/db');
const MessageService = require('../src/services/message.service');
const { query, closePool } = require('../src/config/database');

const TEST_PHONE = 'whatsapp:+573000000XXX';

const steps = [
    { input: '/reset', expected: 'reiniciado tu cuenta' },
    { input: 'Hola', expected: 'Soy Phill' }, // Welcome
    { input: 'Sebastian', expected: 'Aceptas los términos' }, // Name -> Terms
    { input: 'terms', expected: 'Términos y Condiciones' }, // "2" mapped to 'terms'
    { input: 'accept', expected: '¿Qué TIENES hoy?' }, // "1" mapped to 'accept'

    // ASSETS - RETRY FLOW
    { input: '10k en bolsillos', expected: 'Confirma' },
    { input: 'retry', expected: 'Escríbelo de nuevo' }, // "2" mapped to 'retry'
    { input: 'Tengo 50k en Nequi y 100k en Efectivo', expected: 'Confirma' },
    { input: 'accept', expected: '¿Qué DEBES?' }, // "1" mapped to 'accept'

    // LIABILITIES - RETRY FLOW -> THEN ACCEPT VISA
    { input: 'Debo 500k a Visa', expected: 'Confirma' },
    { input: 'retry', expected: 'cuéntame de nuevo' },
    { input: 'Debo 500k a Visa', expected: 'Confirma' }, // Re-enter Visa
    { input: 'accept', expected: 'Radiografía' },

    // TUTORIAL - NO FLOW
    { input: 'no_wait', expected: 'Sin miedo' }, // "no_wait" payload or text? "Mmm... mejor no" is title. ID is 'no_wait'. Used ID.
    { input: 'Bueno dale', expected: 'Dime un gasto' },

    // PARSING CHECK
    { input: 'pague 15.000 comprando una mercancia', expected: '15.000' },
    { input: 'accept', expected: 'salió la plata' },

    // ACCOUNT SELECTION - NUMERIC
    // This one is tricky. The service interprets "2" as index if numeric. 
    // BUT we also support ID if it was a button? No, here it's a list.
    // The previous code `handleExpenseAccountStep` checks `parseInt(message)`.
    // So sending "2" IS correct here.
    { input: 'Visa', expected: 'Listo' },

    // GOALS
    { input: 'Quiero un ferrari', expected: 'Última pregunta' },

    // RISK
    { input: 'Vendo todo', expected: 'DIAGNÓSTICO' },

    // RATING
    { input: '5', expected: 'Gracias' }
];

async function runSimulation() {
    console.log('🚀 Starting Comprehensive Simulation...');

    // Force Reset first
    await MessageService.processMessage('/reset', TEST_PHONE);

    for (const step of steps) {
        console.log(`\n👤 User: "${step.input}"`);
        const response = await MessageService.processMessage(step.input, TEST_PHONE);

        let replyText = '';
        if (typeof response === 'string') replyText = response;
        else if (typeof response === 'object') {
            replyText = response.message;
            if (response.buttons) {
                console.log('   [Buttons]:', response.buttons.map(b => `${b.title} (${b.id})`).join(', '));
            }
        }

        console.log(`🤖 Bot: "${replyText.substring(0, 100)}..."`);

        if (step.expected && !replyText.toLowerCase().includes(step.expected.toLowerCase())) {
            console.error(`❌ FAILED. Expected "${step.expected}" in response.`);
            // Don't exit, keep going to see more failures or recovery
        } else {
            console.log('✅ Passed step');
        }

        // Small delay
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n🏁 Simulation Complete.');
    await closePool();
}

runSimulation();
