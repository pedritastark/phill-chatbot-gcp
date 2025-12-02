const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { Pool } = require('pg');
require('dotenv').config();

// Configuración DB
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Servicios
const MessageService = require('../src/services/message.service');
const UserDBService = require('../src/services/db/user.db.service');
const Logger = require('../src/utils/logger');

// Usuario de prueba
const TEST_PHONE = '+573000000000';
const TEST_NAME = 'Alex';

// Logs de conversación
const conversationLog = [];

async function logInteraction(speaker, text) {
    console.log(`${speaker}: ${text}`);
    conversationLog.push({ speaker, text });
}

async function resetUser() {
    Logger.info('🔄 Reseteando usuario de prueba...');
    await pool.query('DELETE FROM transactions WHERE user_id IN (SELECT user_id FROM users WHERE phone_number = $1)', [TEST_PHONE]);
    await pool.query('DELETE FROM accounts WHERE user_id IN (SELECT user_id FROM users WHERE phone_number = $1)', [TEST_PHONE]);
    await pool.query('DELETE FROM reminders WHERE user_id IN (SELECT user_id FROM users WHERE phone_number = $1)', [TEST_PHONE]);
    await pool.query('DELETE FROM users WHERE phone_number = $1', [TEST_PHONE]);
    Logger.success('✅ Usuario reseteado.');
}

async function simulate() {
    try {
        await resetUser();

        // PASO 1: Inicio
        await logInteraction('Alex', 'Hola');
        let response = await MessageService.processMessage('Hola', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // PASO 2: Efectivo
        await logInteraction('Alex', 'Tengo 150.000 pesos');
        response = await MessageService.processMessage('Tengo 150.000 pesos', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // PASO 3: Banco
        await logInteraction('Alex', 'En el banco hay 2 millones');
        response = await MessageService.processMessage('En el banco hay 2 millones', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // PASO 4: Primer Gasto
        await logInteraction('Alex', 'Pagué 45.000 en el almuerzo con la tarjeta');
        response = await MessageService.processMessage('Pagué 45.000 en el almuerzo con la tarjeta', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // PASO 4.1: Seleccionar Cuenta (Onboarding)
        await logInteraction('Alex', 'Banco');
        response = await MessageService.processMessage('Banco', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // PASO 4.2: Coach Intro (Onboarding)
        await logInteraction('Alex', 'No por ahora');
        response = await MessageService.processMessage('No por ahora', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // PASO 4.3: Reminder Setup (Onboarding)
        await logInteraction('Alex', 'Vale');
        response = await MessageService.processMessage('Vale', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // PASO 5: Inversión (Bitcoin) - AHORA SÍ CON IA
        await logInteraction('Alex', 'Ah, y transferí 500.000 a Bitcoin');
        response = await MessageService.processMessage('Ah, y transferí 500.000 a Bitcoin', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // PASO 6: Confirmar Creación
        await logInteraction('Alex', 'Sí, crea la cuenta, porfa');
        response = await MessageService.processMessage('Sí, crea la cuenta, porfa', TEST_PHONE, TEST_NAME);
        await logInteraction('Phill', typeof response === 'object' ? response.message : response);

        // Generar PDF
        await generatePDF();

        process.exit(0);
    } catch (error) {
        Logger.error('❌ Error en simulación:', error);
        process.exit(1);
    }
}

async function generatePDF() {
    const doc = new PDFDocument();
    const outputPath = path.join(__dirname, '../public/reports/simulation_log.pdf');

    // Asegurar directorio
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    doc.pipe(fs.createWriteStream(outputPath));

    // Título
    doc.fontSize(20).text('Simulación de Flujo: Phill Chatbot', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Fecha: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Conversación
    conversationLog.forEach(entry => {
        const color = entry.speaker === 'Alex' ? '#2563eb' : '#7c3aed'; // Azul para User, Morado para Phill

        doc.font('Helvetica-Bold').fillColor(color).text(`${entry.speaker}:`);
        doc.font('Helvetica').fillColor('#000000').text(entry.text);
        doc.moveDown();
    });

    doc.end();
    Logger.success(`✅ PDF generado en: ${outputPath}`);
}

simulate();
