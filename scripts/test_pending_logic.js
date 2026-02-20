require('dotenv').config();
const FinanceService = require('../src/services/finance.service');
const { AccountDBService, UserDBService } = require('../src/services/db');
const { closePool } = require('../src/config/database');
const Decimal = require('decimal.js');
const Logger = require('../src/utils/logger');

async function runTest() {
    console.log('🧪 Iniciando prueba de lógica "Pending Transaction"...');

    const testPhone = 'whatsapp:+573000000000'; // Usuario dummy

    try {
        // 0. Preparar Usuario Dummy
        const user = await UserDBService.findOrCreate({ phoneNumber: testPhone });

        // 1. Snapshot Inicial
        console.log('📸 Tomando snapshot de saldo inicial...');
        const balanceInitialStr = await AccountDBService.getTotalBalance(user.user_id);
        const balanceInitial = new Decimal(balanceInitialStr || 0);
        console.log(`   Saldo Inicial: ${balanceInitial.toString()}`);

        // 2. La Acción (Crear Gasto Pendiente)
        console.log('🚀 Creando transacción PENDIENTE de 50 USD...');
        const result = await FinanceService.createTransaction(
            testPhone,
            'expense',
            50,
            'Test de Deuda Futura',
            'Pruebas',
            null,
            null,
            'USD',
            'pending'
        );

        console.log(`   Transacción creada ID: ${result.id}, Status: ${result.status}, Currency: ${result.currency}`);

        // 3. Verificaciones
        // 3.1 Chequear que se guardó como pending
        if (result.status !== 'pending') {
            console.error('❌ ERROR CRÍTICO: El status guardado no es "pending".');
            process.exit(1);
        }

        // 3.2 Chequear Saldo Final
        console.log('📸 Verificando saldo final...');
        const balanceFinalStr = await AccountDBService.getTotalBalance(user.user_id);
        const balanceFinal = new Decimal(balanceFinalStr || 0);
        console.log(`   Saldo Final:   ${balanceFinal.toString()}`);

        // 3.3 Comparación
        if (balanceInitial.equals(balanceFinal)) {
            console.log('✅ ÉXITO: El saldo se mantuvo intacto. La transacción pendiente NO afectó el bolsillo.');
        } else {
            const diff = balanceFinal.minus(balanceInitial);
            console.error(`❌ FALLO: El saldo cambió por ${diff.toString()}. La lógica tiene fugas.`);
        }

    } catch (error) {
        console.error('💀 Error ejecutando el test:', error);
    } finally {
        await closePool();
    }
}

runTest();
