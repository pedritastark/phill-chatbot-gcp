const Decimal = require('decimal.js');
const { DateTime } = require('luxon');

console.log('🧪 Iniciando Sanity Check: Finance Logic & Timezone\n');

// 1. Prueba de Precisión Decimal
console.log('--- 1. Math Precision Check (Decimal.js) ---');
console.log('Escenario: 0.1 + 0.2');

const floatResult = 0.1 + 0.2;
console.log(`❌ JavaScript Nativo (Float): ${floatResult}  <-- Error de precisión típico`);

const decimalResult = new Decimal(0.1).plus(0.2);
console.log(`✅ Con Decimal.js:        ${decimalResult.toNumber()} <-- Exacto`);

if (decimalResult.toNumber() === 0.3) {
    console.log('✨ CHECK PASS: Cálculo decimal correcto.\n');
} else {
    console.log('💀 CHECK FAIL: El cálculo decimal falló.\n');
}

// 2. Prueba de Zona Horaria (Luxon)
console.log('--- 2. Timezone Check (Luxon) ---');
console.log("Objetivo: Obtener hora en 'America/Bogota'");

const nowLocal = new Date();
const nowBogota = DateTime.now().setZone('America/Bogota');

console.log(`📅 Hora Sistema (UTC/Local): ${nowLocal.toISOString()}`);
console.log(`🇨🇴 Hora Bogotá (Luxon):      ${nowBogota.toString()}`);
console.log(`   Formato legible:          ${nowBogota.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}`);

if (nowBogota.zoneName === 'America/Bogota') {
    console.log('✨ CHECK PASS: Zona horaria configurada correctamente.\n');
} else {
    console.log('💀 CHECK FAIL: Zona horaria incorrecta.\n');
}

console.log('✅ Sanity Check Completado.');
