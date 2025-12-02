const { Pool } = require('pg');
require('dotenv').config();

// Configuración DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Servicios
const AdminService = require('../src/services/admin.service');
const UserDBService = require('../src/services/db/user.db.service');
const Logger = require('../src/utils/logger');

// Admin Configurado
const ADMIN_PHONE = process.env.ADMIN_PHONE_NUMBER || '+573218372110';
const TEST_USER_PHONE = '+573001234567';

async function simulate() {
    try {
        Logger.info('🧪 Iniciando Simulación de Comandos Admin Avanzados');

        // 1. Crear usuario de prueba
        Logger.info('1️⃣ Creando usuario de prueba...');
        await UserDBService.findOrCreate({ phoneNumber: TEST_USER_PHONE, name: 'TestUser' });

        // 2. Probar User Info
        Logger.info('2️⃣ Probando "User Info"...');
        const infoResponse = await AdminService.handleCommand(`user info ${TEST_USER_PHONE}`, ADMIN_PHONE);
        console.log('Admin Response:', infoResponse);
        if (!infoResponse || !infoResponse.includes('User Info')) throw new Error('User Info falló');

        // 3. Probar Broadcast
        Logger.info('3️⃣ Probando "Broadcast"...');
        const broadcastResponse = await AdminService.handleCommand('broadcast Hola a todos', ADMIN_PHONE);
        console.log('Admin Response:', broadcastResponse);
        if (!broadcastResponse || !broadcastResponse.includes('Broadcast Iniciado')) throw new Error('Broadcast falló');

        // 4. Probar Reset User
        Logger.info('4️⃣ Probando "Reset User"...');
        const resetResponse = await AdminService.handleCommand(`reset user ${TEST_USER_PHONE}`, ADMIN_PHONE);
        console.log('Admin Response:', resetResponse);

        // Verificar que el usuario fue borrado
        const userCheck = await UserDBService.findByPhoneNumber(TEST_USER_PHONE);
        if (userCheck) throw new Error('El usuario NO fue borrado correctamente');
        Logger.success('✅ Usuario borrado correctamente.');

        Logger.success('🎉 Todas las pruebas de Admin pasaron.');
        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en simulación:', error);
        process.exit(1);
    }
}

simulate();
