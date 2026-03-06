#!/usr/bin/env node
/**
 * Test script para verificar el manejo correcto de febrero en fechas
 */

const { addMonthsSafe, buildNextMonthlyDate, isLeapYear, getLastDayOfMonth } = require('../src/utils/dateUtils');

console.log('\n=== Test: Manejo de Febrero en Fechas ===\n');

// Test 1: addMonthsSafe con días 29, 30, 31
console.log('1. addMonthsSafe - Agregar 1 mes a fechas con días 29, 30, 31\n');

const testCases = [
    {
        name: 'Enero 31 → Febrero (año bisiesto)',
        date: new Date(2024, 0, 31), // Jan 31, 2024 (leap year)
        monthsToAdd: 1,
        expectedDay: 29, // Feb 29, 2024
        expectedMonth: 1 // February (0-indexed)
    },
    {
        name: 'Enero 31 → Febrero (año NO bisiesto)',
        date: new Date(2025, 0, 31), // Jan 31, 2025 (non-leap)
        monthsToAdd: 1,
        expectedDay: 28, // Feb 28, 2025
        expectedMonth: 1
    },
    {
        name: 'Enero 30 → Febrero (año bisiesto)',
        date: new Date(2024, 0, 30),
        monthsToAdd: 1,
        expectedDay: 29, // Feb 29, 2024
        expectedMonth: 1
    },
    {
        name: 'Enero 30 → Febrero (año NO bisiesto)',
        date: new Date(2025, 0, 30),
        monthsToAdd: 1,
        expectedDay: 28, // Feb 28, 2025
        expectedMonth: 1
    },
    {
        name: 'Agosto 31 → Septiembre',
        date: new Date(2024, 7, 31), // Aug 31
        monthsToAdd: 1,
        expectedDay: 30, // Sep 30
        expectedMonth: 8 // September
    },
    {
        name: 'Febrero 15 → Marzo',
        date: new Date(2024, 1, 15), // Feb 15
        monthsToAdd: 1,
        expectedDay: 15, // Mar 15
        expectedMonth: 2
    }
];

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
    const result = addMonthsSafe(test.date, test.monthsToAdd);
    const resultDay = result.getDate();
    const resultMonth = result.getMonth();

    const testPassed = resultDay === test.expectedDay && resultMonth === test.expectedMonth;

    console.log(`   ${index + 1}. ${test.name}`);
    console.log(`      Input: ${test.date.toLocaleDateString('es-CO')}`);
    console.log(`      Output: ${result.toLocaleDateString('es-CO')}`);
    console.log(`      Expected: Day ${test.expectedDay}, Month ${test.expectedMonth + 1}`);
    console.log(`      Got: Day ${resultDay}, Month ${resultMonth + 1}`);
    console.log(`      ${testPassed ? '✅ PASS' : '❌ FAIL'}\n`);

    if (testPassed) passed++;
    else failed++;
});

// Test 2: buildNextMonthlyDate
console.log('\n2. buildNextMonthlyDate - Próxima ocurrencia de día del mes\n');

const monthlyTests = [
    {
        name: 'Próximo día 31 desde Feb 15 2025',
        dayOfMonth: 31,
        fromDate: new Date(2025, 1, 15), // Feb 15, 2025
        expectedDay: 28, // Feb 28, 2025 (ajustado)
        expectedMonth: 1
    },
    {
        name: 'Próximo día 31 desde Feb 15 2024',
        dayOfMonth: 31,
        fromDate: new Date(2024, 1, 15), // Feb 15, 2024 (leap year)
        expectedDay: 29, // Feb 29, 2024 (ajustado)
        expectedMonth: 1
    },
    {
        name: 'Próximo día 31 desde Mar 15',
        dayOfMonth: 31,
        fromDate: new Date(2024, 2, 15), // Mar 15
        expectedDay: 31, // Mar 31
        expectedMonth: 2
    },
    {
        name: 'Próximo día 30 desde Feb 10 2024',
        dayOfMonth: 30,
        fromDate: new Date(2024, 1, 10),
        expectedDay: 29, // Feb 29 (ajustado)
        expectedMonth: 1
    }
];

monthlyTests.forEach((test, index) => {
    const result = buildNextMonthlyDate(test.dayOfMonth, test.fromDate);
    const resultDay = result.getDate();
    const resultMonth = result.getMonth();

    const testPassed = resultDay === test.expectedDay && resultMonth === test.expectedMonth;

    console.log(`   ${index + 1}. ${test.name}`);
    console.log(`      From: ${test.fromDate.toLocaleDateString('es-CO')}, Target day: ${test.dayOfMonth}`);
    console.log(`      Result: ${result.toLocaleDateString('es-CO')}`);
    console.log(`      Expected: Day ${test.expectedDay}, Month ${test.expectedMonth + 1}`);
    console.log(`      Got: Day ${resultDay}, Month ${resultMonth + 1}`);
    console.log(`      ${testPassed ? '✅ PASS' : '❌ FAIL'}\n`);

    if (testPassed) passed++;
    else failed++;
});

// Test 3: isLeapYear
console.log('\n3. isLeapYear - Detección de años bisiestos\n');

const leapYearTests = [
    { year: 2024, expected: true, reason: 'Divisible por 4, no por 100' },
    { year: 2025, expected: false, reason: 'No divisible por 4' },
    { year: 2000, expected: true, reason: 'Divisible por 400' },
    { year: 1900, expected: false, reason: 'Divisible por 100, no por 400' },
    { year: 2028, expected: true, reason: 'Divisible por 4' }
];

leapYearTests.forEach((test, index) => {
    const result = isLeapYear(test.year);
    const testPassed = result === test.expected;

    console.log(`   ${index + 1}. Año ${test.year}`);
    console.log(`      Expected: ${test.expected ? 'Bisiesto' : 'NO bisiesto'} (${test.reason})`);
    console.log(`      Got: ${result ? 'Bisiesto' : 'NO bisiesto'}`);
    console.log(`      ${testPassed ? '✅ PASS' : '❌ FAIL'}\n`);

    if (testPassed) passed++;
    else failed++;
});

// Test 4: getLastDayOfMonth
console.log('\n4. getLastDayOfMonth - Último día del mes\n');

const lastDayTests = [
    { year: 2024, month: 1, expected: 29, name: 'Febrero 2024 (bisiesto)' },
    { year: 2025, month: 1, expected: 28, name: 'Febrero 2025 (NO bisiesto)' },
    { year: 2024, month: 0, expected: 31, name: 'Enero' },
    { year: 2024, month: 3, expected: 30, name: 'Abril' },
    { year: 2024, month: 11, expected: 31, name: 'Diciembre' }
];

lastDayTests.forEach((test, index) => {
    const result = getLastDayOfMonth(test.year, test.month);
    const testPassed = result === test.expected;

    console.log(`   ${index + 1}. ${test.name} ${test.year}`);
    console.log(`      Expected: ${test.expected} días`);
    console.log(`      Got: ${result} días`);
    console.log(`      ${testPassed ? '✅ PASS' : '❌ FAIL'}\n`);

    if (testPassed) passed++;
    else failed++;
});

console.log('\n' + '='.repeat(60));
console.log(`Resultados: ${passed} PASS, ${failed} FAIL de ${passed + failed} tests`);
console.log('='.repeat(60) + '\n');

if (failed === 0) {
    console.log('✅ Todos los tests de manejo de febrero pasaron!\n');
    process.exit(0);
} else {
    console.log('❌ Algunos tests fallaron\n');
    process.exit(1);
}
