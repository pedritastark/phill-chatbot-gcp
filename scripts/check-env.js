#!/usr/bin/env node

/**
 * Script para verificar que las variables de entorno estén configuradas
 */

require('dotenv').config();

const requiredVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'GEMINI_API_KEY',
];

console.log('\n🔍 Verificando configuración del .env...\n');

let allOk = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  
  if (!value || value === `your_${varName.toLowerCase()}_here` || value.includes('your_')) {
    console.log(`❌ ${varName}: NO CONFIGURADO`);
    allOk = false;
  } else {
    // Mostrar solo los primeros y últimos caracteres por seguridad
    const maskedValue = value.length > 10 
      ? `${value.substring(0, 6)}...${value.substring(value.length - 4)}`
      : '***';
    console.log(`✅ ${varName}: ${maskedValue}`);
  }
});

console.log(`\n📍 PORT: ${process.env.PORT || 3001}`);
console.log(`🤖 GEMINI_MODEL: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'}`);
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

console.log('\n' + '='.repeat(50));

if (allOk) {
  console.log('✅ ¡Todas las variables están configuradas correctamente!');
  console.log('\n🚀 Puedes iniciar el servidor con: npm start\n');
  process.exit(0);
} else {
  console.log('❌ Faltan variables por configurar');
  console.log('\n📝 Edita tu archivo .env con tus credenciales');
  console.log('📚 Lee QUICKSTART.md para más información\n');
  process.exit(1);
}

