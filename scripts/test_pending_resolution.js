require('dotenv').config();
const financeService = require('../src/services/finance.service');
const { closePool } = require('../src/config/database');
const Logger = require('../src/utils/logger');

async function testResolution() {
    console.log('🧪 Iniciando prueba de Conciliación de Pendientes...');

    // 1. Crear usuario/contexto simular
    const userId = 'whatsapp:+573000000000';

    // 2. Intentar registrar (Completar) la transacción que sabemos que está pendiente (del test anterior 50 USD)
    // Nota: Si corriste el test anterior, hay una de 50 USD 'pending'.
    // Intentaremos "pagarla" con un monto similar.

    try {
        console.log('🔄 Intentando pagar "Test de Deuda Futura" (50 USD)...');

        const result = await financeService.createTransaction(
            userId,
            'expense',
            50, // Mismo monto
            'Deuda', // Descripción "Deuda" debería hacer match con "Test de Deuda Futura" 
            // Espera, el DB service usa ILIKE %text%. 
            // La descripción original era "Test de Deuda Futura".
            // Si el user dice "Ya pagué la deuda futura", debería hacer match.
            'Entretenimiento',
            null,
            null,
            'USD',
            'completed'
        );

        if (result.was_pending_resolved) {
            console.log('✅ ÉXITO: Se detectó y resolvió el pendiente.');
            console.log('Mensaje:', result.confirmation_text);
        } else {
            console.log('⚠️ AVISO: No se resolvió pendiente, se creó nueva (posible fallo de coincidencia).');
            console.log('Result:', result.transaction_id, result.status);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await closePool();
    }
}

testResolution();
