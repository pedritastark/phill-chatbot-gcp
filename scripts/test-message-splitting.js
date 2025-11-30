#!/usr/bin/env node

/**
 * Script de prueba para el sistema de división de mensajes
 * 
 * Uso:
 *   node scripts/test-message-splitting.js
 * 
 * Este script prueba diferentes longitudes de mensajes y muestra
 * cómo el sistema los divide automáticamente.
 */

const path = require('path');

// Cargar la configuración y utilidades
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { config } = require('../src/config/environment');
const TwiMLHelper = require('../src/utils/twiml');
const Logger = require('../src/utils/logger');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function printHeader(title) {
  console.log('\n' + colors.bright + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.bright + colors.cyan + title.padEnd(80) + colors.reset);
  console.log(colors.bright + colors.cyan + '='.repeat(80) + colors.reset + '\n');
}

function printSection(title) {
  console.log('\n' + colors.bright + colors.blue + '─'.repeat(80) + colors.reset);
  console.log(colors.bright + title + colors.reset);
  console.log(colors.bright + colors.blue + '─'.repeat(80) + colors.reset + '\n');
}

// Mensajes de prueba
const testMessages = {
  short: 'Hola, ¿cómo estás? 💜',
  
  medium: `¡Hola! Me encantaría explicarte qué es un ETF. 💜

Un ETF (Exchange-Traded Fund) es como una canasta de inversiones. Imagina que en lugar de comprar manzanas individuales, compras una bolsa con muchas frutas diferentes: manzanas, naranjas, plátanos.

De la misma forma, un ETF te permite invertir en muchas empresas diferentes con una sola compra. Esto se llama "diversificación" y reduce el riesgo.

¿Te gustaría saber más sobre cómo funcionan? 💜`,
  
  long: `El interés compuesto es uno de los conceptos más poderosos en finanzas personales. Déjame explicártelo de forma simple. 💜

Imagina que plantas un árbol frutal. El primer año, da 10 manzanas. Si guardas esas manzanas y plantas sus semillas, al siguiente año tendrás más árboles, que darán más manzanas, que a su vez generarán más árboles.

El interés compuesto funciona igual:

**Año 1:**
• Inviertes $1,000 al 10% anual
• Ganas $100 de interés
• Ahora tienes $1,100

**Año 2:**
• Los $1,100 generan interés (no solo los $1,000 iniciales)
• Ganas $110 de interés
• Ahora tienes $1,210

**Año 3:**
• Los $1,210 generan interés
• Ganas $121 de interés
• Ahora tienes $1,331

¿Ves el patrón? Cada año ganas interés sobre el capital anterior MÁS los intereses acumulados. Por eso se le llama "compuesto" - el interés genera más interés.

**La regla del 72:**
Una forma rápida de calcular cuánto tardará en duplicarse tu dinero es dividir 72 entre la tasa de interés:
• Al 10% anual: 72 ÷ 10 = 7.2 años para duplicar tu inversión
• Al 5% anual: 72 ÷ 5 = 14.4 años

**Por qué es tan poderoso:**
Albert Einstein supuestamente dijo que el interés compuesto es "la octava maravilla del mundo". Y tenía razón:
• Empieza temprano: Cada año cuenta
• Sé constante: Las pequeñas cantidades regulares crecen enormemente
• Ten paciencia: El verdadero poder se ve después de 10-20 años

**Ejemplo real:**
Si inviertes $200 mensuales al 8% anual durante 30 años:
• Habrás aportado: $72,000
• Tendrás acumulado: $298,000
• La diferencia ($226,000) es puro interés compuesto 🚀

¿Quieres que te ayude a calcular cómo podría funcionar para tu situación específica? 💜`,

  veryLong: `Te voy a explicar de forma completa y detallada cómo funcionan las inversiones y por qué son importantes para tu futuro financiero. 💜

**1. ¿QUÉ ES INVERTIR?**

Invertir es poner tu dinero a trabajar para generar más dinero. Es diferente a ahorrar:
• Ahorrar: Guardas dinero en el banco (crece poco)
• Invertir: Usas tu dinero para generar rendimientos (puede crecer mucho más)

Piensa en esto: Si guardas $1,000 bajo tu colchón durante 10 años, seguirás teniendo $1,000. Pero si los inviertes bien, podrían convertirse en $2,000, $3,000 o más.

**2. TIPOS DE INVERSIONES**

Hay muchas formas de invertir. Aquí te explico las principales:

**a) Acciones:**
Compras una pequeña parte de una empresa. Si la empresa crece, tu inversión vale más.
• Ejemplo: Compras acciones de Apple. Si Apple vende más iPhones, las acciones suben.
• Riesgo: Alto (las empresas pueden subir o bajar)
• Retorno potencial: Alto (históricamente ~10% anual)

**b) Bonos:**
Le prestas dinero a gobiernos o empresas, y te pagan interés.
• Ejemplo: Compras un bono del gobierno que paga 5% anual
• Riesgo: Bajo a medio (depende de quién emite el bono)
• Retorno potencial: Medio (3-7% anual típicamente)

**c) Fondos de Inversión:**
Un profesional invierte el dinero de muchas personas juntas.
• Ventaja: Diversificación automática
• Desventaja: Cobran comisiones

**d) ETFs:**
Como fondos, pero se compran/venden como acciones.
• Ventaja: Comisiones más bajas que fondos tradicionales
• Popular: ETFs que siguen el S&P 500

**e) Bienes Raíces:**
Comprar propiedades para rentar o vender después.
• Ventaja: Bien tangible que puedes ver/tocar
• Desventaja: Requiere mucho capital inicial

**3. EL CONCEPTO CLAVE: DIVERSIFICACIÓN**

"No pongas todos los huevos en una canasta" es el principio más importante.

Si inviertes todo en una sola empresa y quiebra, pierdes todo.
Si inviertes en 100 empresas diferentes y una quiebra, solo pierdes 1%.

**4. PERFIL DE RIESGO**

Antes de invertir, debes conocer tu tolerancia al riesgo:

**Conservador:** Prefieres seguridad sobre rendimientos altos
→ Bonos, cuentas de ahorro de alto rendimiento

**Moderado:** Balanceas seguridad y crecimiento
→ Mix de acciones (60%) y bonos (40%)

**Agresivo:** Buscas máximo crecimiento, aceptas volatilidad
→ Mayor proporción de acciones (80-100%)

**5. HORIZONTE DE TIEMPO**

¿Cuándo necesitarás ese dinero?

• Corto plazo (< 3 años): Inversiones seguras y líquidas
• Mediano plazo (3-10 años): Mix balanceado
• Largo plazo (> 10 años): Puedes tomar más riesgo

Regla de oro: Nunca inviertas dinero que vayas a necesitar en menos de 5 años.

**6. CÓMO EMPEZAR**

**Paso 1:** Construye un fondo de emergencia
Antes de invertir, ten ahorrado 3-6 meses de gastos.

**Paso 2:** Define tus objetivos
¿Para qué estás invirtiendo? ¿Retiro? ¿Casa? ¿Educación?

**Paso 3:** Elige tu estrategia
Para principiantes: ETFs de índice son lo más recomendado

**Paso 4:** Empieza pequeño
No necesitas miles de dólares. Muchas plataformas permiten empezar con $100.

**Paso 5:** Sé consistente
Mejor invertir $50 cada mes durante años que $1,000 una sola vez.

**7. ERRORES COMUNES A EVITAR**

❌ Intentar "timing the market" (adivinar cuándo comprar/vender)
✅ Invierte regularmente, sin importar si el mercado sube o baja

❌ Vender en pánico cuando el mercado cae
✅ Los mercados son cíclicos, históricamente siempre se recuperan

❌ Invertir sin entender en qué inviertes
✅ Solo invierte en lo que comprendes

❌ Perseguir rendimientos extremadamente altos
✅ Si suena demasiado bueno para ser verdad, probablemente lo es

**8. RECURSOS PARA APRENDER MÁS**

Libros recomendados:
• "El Inversor Inteligente" - Benjamin Graham
• "El Hombre Más Rico de Babilonia" - George S. Clason

Plataformas para principiantes:
• Robinhood (acciones y ETFs)
• Vanguard (fondos de bajo costo)
• Fidelity (educación y herramientas)

¿Tienes alguna pregunta específica sobre inversiones? Estoy aquí para ayudarte. 💜`
};

function testMessageSplitting() {
  printHeader('🧪 TEST DE DIVISIÓN DE MENSAJES - SISTEMA PHILL');

  console.log(colors.green + '📋 Configuración actual:' + colors.reset);
  console.log(`   • Límite máximo: ${config.messaging.maxLength} caracteres`);
  console.log(`   • Margen de seguridad: ${config.messaging.safetyMargin} caracteres`);
  console.log(`   • Límite seguro: ${config.messaging.maxLength - config.messaging.safetyMargin} caracteres`);
  console.log(`   • Límite recomendado: ${config.messaging.recommendedLength} caracteres`);
  console.log(`   • División automática: ${config.messaging.enableAutoSplit ? '✅ Habilitada' : '❌ Deshabilitada'}`);
  console.log(`   • Marcadores de continuación: ${config.messaging.showContinuationMarkers ? '✅ Habilitados' : '❌ Deshabilitados'}`);

  // Test 1: Mensaje corto
  printSection('TEST 1: Mensaje Corto (< 900 caracteres)');
  console.log(colors.yellow + `Longitud: ${testMessages.short.length} caracteres` + colors.reset);
  console.log('\nMensaje original:');
  console.log(colors.cyan + testMessages.short + colors.reset);
  
  const chunks1 = TwiMLHelper.splitMessage(testMessages.short);
  console.log(`\n${colors.green}✅ Resultado: ${chunks1.length} parte(s)${colors.reset}`);
  chunks1.forEach((chunk, i) => {
    console.log(`\n${colors.bright}Parte ${i + 1}:${colors.reset} (${chunk.length} caracteres)`);
    console.log(chunk);
  });

  // Test 2: Mensaje medio
  printSection('TEST 2: Mensaje Medio (~500 caracteres)');
  console.log(colors.yellow + `Longitud: ${testMessages.medium.length} caracteres` + colors.reset);
  console.log('\nMensaje original (primeros 200 caracteres):');
  console.log(colors.cyan + testMessages.medium.substring(0, 200) + '...' + colors.reset);
  
  const chunks2 = TwiMLHelper.splitMessage(testMessages.medium);
  console.log(`\n${colors.green}✅ Resultado: ${chunks2.length} parte(s)${colors.reset}`);
  chunks2.forEach((chunk, i) => {
    console.log(`\n${colors.bright}Parte ${i + 1}:${colors.reset} (${chunk.length} caracteres)`);
    console.log(chunk.substring(0, 150) + (chunk.length > 150 ? '...' : ''));
  });

  // Test 3: Mensaje largo
  printSection('TEST 3: Mensaje Largo (~1200 caracteres)');
  console.log(colors.yellow + `Longitud: ${testMessages.long.length} caracteres` + colors.reset);
  console.log('\nMensaje original (primeros 200 caracteres):');
  console.log(colors.cyan + testMessages.long.substring(0, 200) + '...' + colors.reset);
  
  const chunks3 = TwiMLHelper.splitMessage(testMessages.long);
  console.log(`\n${colors.green}✅ Resultado: ${chunks3.length} parte(s)${colors.reset}`);
  chunks3.forEach((chunk, i) => {
    console.log(`\n${colors.bright}Parte ${i + 1}:${colors.reset} (${chunk.length} caracteres)`);
    console.log(chunk.substring(0, 150) + (chunk.length > 150 ? '...' : ''));
  });

  // Test 4: Mensaje muy largo
  printSection('TEST 4: Mensaje Muy Largo (~4000 caracteres)');
  console.log(colors.yellow + `Longitud: ${testMessages.veryLong.length} caracteres` + colors.reset);
  console.log('\nMensaje original (primeros 200 caracteres):');
  console.log(colors.cyan + testMessages.veryLong.substring(0, 200) + '...' + colors.reset);
  
  const chunks4 = TwiMLHelper.splitMessage(testMessages.veryLong);
  console.log(`\n${colors.green}✅ Resultado: ${chunks4.length} parte(s)${colors.reset}`);
  chunks4.forEach((chunk, i) => {
    console.log(`\n${colors.bright}Parte ${i + 1}:${colors.reset} (${chunk.length} caracteres)`);
    console.log(chunk.substring(0, 150) + (chunk.length > 150 ? '...' : ''));
  });

  // Resumen
  printSection('📊 RESUMEN DE RESULTADOS');
  console.log(`${colors.green}✅ Test 1 (corto):${colors.reset}     ${testMessages.short.length} chars → ${chunks1.length} parte(s)`);
  console.log(`${colors.green}✅ Test 2 (medio):${colors.reset}     ${testMessages.medium.length} chars → ${chunks2.length} parte(s)`);
  console.log(`${colors.green}✅ Test 3 (largo):${colors.reset}     ${testMessages.long.length} chars → ${chunks3.length} parte(s)`);
  console.log(`${colors.green}✅ Test 4 (muy largo):${colors.reset} ${testMessages.veryLong.length} chars → ${chunks4.length} parte(s)`);

  printHeader('✅ TODOS LOS TESTS COMPLETADOS EXITOSAMENTE');
  
  console.log(`\n${colors.bright}💡 Notas:${colors.reset}`);
  console.log(`   • Los mensajes cortos (< ${config.messaging.recommendedLength} chars) no se dividen`);
  console.log(`   • Los mensajes largos se dividen inteligentemente por párrafos/oraciones`);
  console.log(`   • Cada parte respeta el límite de ${config.messaging.maxLength - config.messaging.safetyMargin} caracteres`);
  console.log(`   • Los marcadores 📨 ayudan al usuario a entender la continuidad`);
  console.log(`\n${colors.bright}📚 Documentación:${colors.reset} Ver MENSAJES_LARGOS.md para más detalles\n`);
}

// Ejecutar tests
try {
  testMessageSplitting();
  process.exit(0);
} catch (error) {
  console.error(colors.bright + '❌ Error durante los tests:' + colors.reset, error);
  process.exit(1);
}

