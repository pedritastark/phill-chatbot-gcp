const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { config } = require('../config/environment');
const TransactionDBService = require('./db/transaction.db.service');
const UserDBService = require('./db/user.db.service');
const AIService = require('./ai.service');
const Logger = require('../utils/logger');
const { formatCurrency } = require('../utils/formatter');

class VisualReportService {
    constructor() {
        this.reportsDir = path.join(__dirname, '../../public/reports');
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    /**
     * Genera un reporte visual semanal (tipo Story)
     * @param {string} userId - Teléfono del usuario
     * @param {boolean} censored - Si es true, oculta los montos
     * @returns {Promise<string>} - URL de la imagen generada
     */
    async generateWeeklyReport(userId, censored = false) {
        try {
            const user = await UserDBService.findByPhoneNumber(userId);
            if (!user) throw new Error('Usuario no encontrado');

            // Fechas
            const today = new Date();
            const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

            // Obtener transacciones de esta semana
            const currentWeekTransactions = await TransactionDBService.findByUser(user.user_id, {
                startDate: oneWeekAgo.toISOString(),
                endDate: today.toISOString(),
                type: 'expense'
            });

            // Obtener transacciones de la semana pasada (para comparar)
            const previousWeekTransactions = await TransactionDBService.findByUser(user.user_id, {
                startDate: twoWeeksAgo.toISOString(),
                endDate: oneWeekAgo.toISOString(),
                type: 'expense'
            });

            // Cálculos
            const currentTotal = currentWeekTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
            const previousTotal = previousWeekTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

            // Top Category
            const categories = {};
            currentWeekTransactions.forEach(t => {
                if (!categories[t.category_name]) {
                    categories[t.category_name] = { amount: 0, icon: t.category_icon || '💸', color: t.category_color || '#a78bfa' };
                }
                categories[t.category_name].amount += parseFloat(t.amount);
            });

            const sortedCategories = Object.entries(categories)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.amount - a.amount);

            const topCategory = sortedCategories[0] || { name: 'Nada', amount: 0, icon: '✨' };

            // Comparación
            let comparisonText = '';
            let comparisonColor = '#ffffff';
            let vibeEmoji = '🧘‍♂️'; // Default balanced

            if (previousTotal > 0) {
                const diffPercent = ((currentTotal - previousTotal) / previousTotal) * 100;
                if (diffPercent > 10) {
                    comparisonText = `🔺 ${Math.round(diffPercent)}% más que la semana pasada`;
                    comparisonColor = '#ef4444'; // Rojo
                    vibeEmoji = '🥵'; // Hot/Sweating
                } else if (diffPercent < -10) {
                    comparisonText = `🔻 ${Math.abs(Math.round(diffPercent))}% menos que la semana pasada`;
                    comparisonColor = '#22c55e'; // Verde
                    vibeEmoji = '🔥'; // On fire/Saving
                } else {
                    comparisonText = '⚖️ Igual que la semana pasada';
                    comparisonColor = '#fbbf24'; // Amarillo
                    vibeEmoji = '🧘‍♂️'; // Balanced
                }
            } else {
                comparisonText = '📊 Primera semana registrada';
            }

            // Generar comentario IA (solo si no es censurado para no gastar tokens, o siempre? mejor siempre para consistencia)
            // Pero si es censurado, tal vez el comentario deba ser genérico? No, el comentario es la "cereza".
            const aiComment = await AIService.generateWeeklyComment({
                totalExpense: formatCurrency(currentTotal),
                topCategory: topCategory.name,
                topCategoryAmount: formatCurrency(topCategory.amount),
                balance: 'N/A', // No tenemos balance total aquí fácil, pero no importa tanto para el roast de gastos
                comparison: comparisonText
            });

            // --- DIBUJAR CANVAS ---
            const width = 1080;
            const height = 1920;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // 1. Fondo (Dark Mode #121212)
            ctx.fillStyle = '#121212';
            ctx.fillRect(0, 0, width, height);

            // Gradiente sutil arriba
            const gradient = ctx.createLinearGradient(0, 0, 0, 600);
            gradient.addColorStop(0, '#2e1065'); // Morado oscuro
            gradient.addColorStop(1, '#121212');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, 600);

            // 2. Header
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 60px Arial';
            ctx.fillText('TU SEMANA CON PHILL', width / 2, 150);

            ctx.font = '40px Arial';
            ctx.fillStyle = '#a1a1aa'; // Gris claro
            const dateOptions = { day: 'numeric', month: 'short' };
            const dateRange = `${oneWeekAgo.toLocaleDateString('es-CO', dateOptions)} - ${today.toLocaleDateString('es-CO', dateOptions)}`;
            ctx.fillText(dateRange, width / 2, 220);

            // 3. The Vibe (Termómetro)
            ctx.font = '200px Arial';
            ctx.fillText(vibeEmoji, width / 2, 450);

            // 4. The Damage (Total)
            ctx.font = 'bold 40px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('Total Gastado', width / 2, 600);

            ctx.font = 'bold 120px Arial';
            ctx.fillStyle = '#a78bfa'; // Morado Phill
            const displayAmount = censored ? '$****' : formatCurrency(currentTotal);
            ctx.fillText(displayAmount, width / 2, 730);

            ctx.font = 'bold 40px Arial';
            ctx.fillStyle = comparisonColor;
            ctx.fillText(comparisonText, width / 2, 820);

            // 5. Top Offender (Ring Chart)
            // Dibujar anillo
            const centerX = width / 2;
            const centerY = 1100;
            const radius = 150;
            const lineWidth = 40;

            // Fondo del anillo
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#3f3f46'; // Gris oscuro
            ctx.lineWidth = lineWidth;
            ctx.stroke();

            // Parte llena (Top Category vs Total)
            const percentage = currentTotal > 0 ? (topCategory.amount / currentTotal) : 0;
            const endAngle = -0.5 * Math.PI + (2 * Math.PI * percentage);

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, -0.5 * Math.PI, endAngle);
            ctx.strokeStyle = topCategory.color || '#f472b6'; // Color categoría o rosa
            ctx.stroke();

            // Texto dentro del anillo
            ctx.font = '80px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(topCategory.icon, centerX, centerY + 30);

            // Texto debajo del anillo
            ctx.font = 'bold 50px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`Tu debilidad: ${topCategory.name}`, width / 2, centerY + 250);

            ctx.font = '40px Arial';
            ctx.fillStyle = '#f87171';
            const displayTopAmount = censored ? '$****' : formatCurrency(topCategory.amount);
            ctx.fillText(displayTopAmount, width / 2, centerY + 310);

            // 6. Racha (Streak)
            const streak = user.current_streak || 0;
            ctx.font = 'bold 50px Arial';
            ctx.fillStyle = '#fbbf24'; // Dorado
            ctx.fillText(`🔥 ${streak} días en racha`, width / 2, 1550);

            // 7. Comentario de Phill (Bubble)
            // Dibujar burbuja
            const bubbleY = 1650;
            const bubbleHeight = 200;
            const bubbleWidth = 900;
            const bubbleX = (width - bubbleWidth) / 2;

            ctx.fillStyle = '#27272a'; // Gris zinc
            // Round rect manual simple
            ctx.beginPath();
            ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 30);
            ctx.fill();

            // Triángulo de la burbuja
            ctx.beginPath();
            ctx.moveTo(width / 2 - 20, bubbleY + bubbleHeight);
            ctx.lineTo(width / 2 + 20, bubbleY + bubbleHeight);
            ctx.lineTo(width / 2, bubbleY + bubbleHeight + 30);
            ctx.fill();

            // Texto del comentario (Wrap text logic simple)
            ctx.font = 'italic 35px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';

            // Simple text wrap logic
            const words = aiComment.split(' ');
            let line = '';
            let lines = [];
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > bubbleWidth - 60 && n > 0) {
                    lines.push(line);
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);

            // Dibujar líneas centradas verticalmente en la burbuja
            const lineHeight = 45;
            const startY = bubbleY + (bubbleHeight - (lines.length * lineHeight)) / 2 + 30;

            lines.forEach((l, i) => {
                ctx.fillText(l, width / 2, startY + (i * lineHeight));
            });

            // Guardar imagen
            const suffix = censored ? '_censored' : '';
            const fileName = `weekly_report_${userId}_${Date.now()}${suffix}.jpg`;
            const filePath = path.join(this.reportsDir, fileName);
            const buffer = canvas.toBuffer('image/jpeg');
            fs.writeFileSync(filePath, buffer);

            Logger.success(`Reporte visual generado: ${filePath}`);

            // Construir URL pública
            const baseUrl = config.baseUrl || `http://localhost:${config.port}`;
            return `${baseUrl}/public/reports/${fileName}`;

        } catch (error) {
            Logger.error('Error generando reporte visual', error);
            throw error;
        }
    }
}

module.exports = new VisualReportService();
