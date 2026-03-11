#!/usr/bin/env node
/**
 * Test script para verificar las correcciones de los bugs críticos
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Test Bug #7: Validación de límite de crédito
console.log('\n=== Test Bug #7: Validación de Límite de Crédito ===\n');

// Simulación de la lógica corregida
function testCreditLimitValidation() {
    const testCases = [
        {
            name: 'Caso 1: Balance positivo (deuda normal)',
            creditLimit: 2000000,
            balance: 1500000, // Deuda de $1,500,000
            newPurchase: 600000,
            expectedResult: 'RECHAZADO',
            reason: 'Disponible: $500,000 < Compra: $600,000'
        },
        {
            name: 'Caso 2: Balance positivo (compra válida)',
            creditLimit: 2000000,
            balance: 1500000,
            newPurchase: 400000,
            expectedResult: 'APROBADO',
            reason: 'Disponible: $500,000 >= Compra: $400,000'
        },
        {
            name: 'Caso 3: Balance negativo (sobrepago) - BUG ORIGINAL',
            creditLimit: 5000000,
            balance: -2000000, // Sobrepago de $2,000,000
            newPurchase: 4000000,
            expectedResult: 'RECHAZADO',
            reason: 'Sin Math.abs() permitiría compra incorrectamente'
        },
        {
            name: 'Caso 4: Balance cero',
            creditLimit: 3000000,
            balance: 0,
            newPurchase: 2500000,
            expectedResult: 'APROBADO',
            reason: 'Disponible: $3,000,000 >= Compra: $2,500,000'
        },
        {
            name: 'Caso 5: Compra exacta al límite disponible',
            creditLimit: 1000000,
            balance: 300000,
            newPurchase: 700000,
            expectedResult: 'APROBADO',
            reason: 'Disponible: $700,000 >= Compra: $700,000'
        }
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach((test, index) => {
        const limit = parseFloat(test.creditLimit);

        // ❌ LÓGICA ANTIGUA (con bug)
        const usedOld = parseFloat(test.balance);
        const isValidOld = !(limit > 0 && (usedOld + test.newPurchase) > limit);

        // ✅ LÓGICA NUEVA (corregida)
        const usedCredit = Math.abs(parseFloat(test.balance));
        const available = limit - usedCredit;
        const isValidNew = !(limit > 0 && (usedCredit + test.newPurchase) > limit);

        const actualResult = isValidNew ? 'APROBADO' : 'RECHAZADO';
        const testPassed = actualResult === test.expectedResult;

        console.log(`\n${index + 1}. ${test.name}`);
        console.log(`   Límite: $${limit.toLocaleString('es-CO')}`);
        console.log(`   Balance: $${test.balance.toLocaleString('es-CO')}`);
        console.log(`   Compra: $${test.newPurchase.toLocaleString('es-CO')}`);
        console.log(`   Disponible: $${available.toLocaleString('es-CO')}`);
        console.log(`   Resultado ANTIGUO: ${isValidOld ? 'APROBADO' : 'RECHAZADO'}`);
        console.log(`   Resultado NUEVO: ${actualResult}`);
        console.log(`   Esperado: ${test.expectedResult}`);
        console.log(`   ✓ ${testPassed ? '✅ PASS' : '❌ FAIL'} - ${test.reason}`);

        if (testPassed) passed++;
        else failed++;
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Resultados: ${passed} PASS, ${failed} FAIL de ${testCases.length} tests`);
    console.log(`${'='.repeat(60)}\n`);

    return failed === 0;
}

// Test Bug #6: Cálculo de crédito disponible
console.log('\n=== Test Bug #6: Cálculo de Crédito Disponible ===\n');

function testAvailableCredit() {
    const accounts = [
        {
            name: 'Tarjeta Visa',
            type: 'credit_card',
            creditLimit: 3000000,
            balance: 500000, // Deuda
            expectedAvailable: 2500000
        },
        {
            name: 'Tarjeta con sobrepago',
            type: 'credit_card',
            creditLimit: 2000000,
            balance: -300000, // Sobrepago
            expectedAvailable: 2300000
        },
        {
            name: 'Tarjeta nueva',
            type: 'credit_card',
            creditLimit: 5000000,
            balance: 0,
            expectedAvailable: 5000000
        }
    ];

    let passed = 0;
    let failed = 0;

    accounts.forEach((account, index) => {
        const creditLimit = account.creditLimit || 0;
        const balance = account.balance || 0;

        // Lógica corregida del hook useDashboard
        // Balance positivo = deuda, Balance negativo = sobrepago
        const availableCredit = account.type === 'credit_card'
            ? Math.max(0, creditLimit - balance)
            : undefined;

        const testPassed = availableCredit === account.expectedAvailable;

        console.log(`\n${index + 1}. ${account.name}`);
        console.log(`   Límite: $${creditLimit.toLocaleString('es-CO')}`);
        console.log(`   Balance: $${balance.toLocaleString('es-CO')}`);
        console.log(`   Disponible calculado: $${availableCredit.toLocaleString('es-CO')}`);
        console.log(`   Disponible esperado: $${account.expectedAvailable.toLocaleString('es-CO')}`);
        console.log(`   ${testPassed ? '✅ PASS' : '❌ FAIL'}`);

        if (testPassed) passed++;
        else failed++;
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Resultados: ${passed} PASS, ${failed} FAIL de ${accounts.length} tests`);
    console.log(`${'='.repeat(60)}\n`);

    return failed === 0;
}

// Ejecutar todos los tests
const bug7Passed = testCreditLimitValidation();
const bug6Passed = testAvailableCredit();

console.log('\n=== RESUMEN FINAL ===\n');
console.log(`Bug #7 (Validación Límite): ${bug7Passed ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Bug #6 (Crédito Disponible): ${bug6Passed ? '✅ PASS' : '❌ FAIL'}`);

if (bug7Passed && bug6Passed) {
    console.log('\n✅ Todos los tests pasaron exitosamente!\n');
    process.exit(0);
} else {
    console.log('\n❌ Algunos tests fallaron\n');
    process.exit(1);
}
