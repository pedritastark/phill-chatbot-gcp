const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { config } = require('../config/environment');
const Logger = require('../utils/logger');
const { formatCurrency } = require('../utils/formatter');
const TransactionDBService = require('./db/transaction.db.service');
const UserDBService = require('./db/user.db.service');

class ReportService {
    constructor() {
        this.width = 800; // Ancho del gráfico
        this.height = 400; // Alto del gráfico
        this.chartCallback = (ChartJS) => {
            ChartJS.defaults.responsive = true;
            ChartJS.defaults.maintainAspectRatio = false;
        };
        this.chartJSNodeCanvas = new ChartJSNodeCanvas({ width: this.width, height: this.height, chartCallback: this.chartCallback });
    }

    /**
     * Genera un reporte mensual para un usuario
     * @param {string} userId - ID del usuario (teléfono)
     * @param {number} month - Mes (1-12)
     * @param {number} year - Año
     * @returns {Promise<string>} - URL del reporte generado
     */
    async generateMonthlyReport(userId, month, year) {
        try {
            const user = await UserDBService.findByPhoneNumber(userId);
            if (!user) throw new Error('Usuario no encontrado');

            // 1. Obtener transacciones del mes
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59); // Último día del mes

            // Usar TransactionDBService para filtrar por fecha (necesitamos asegurar que soporte filtros de fecha)
            // Si no soporta, traemos todas y filtramos aquí (MVP) o mejor, añadimos soporte en DB service.
            // Por ahora, asumiremos que getByUser trae todo y filtramos en memoria para el MVP.
            const allTransactions = await TransactionDBService.findByUser(user.user_id);
            const transactions = allTransactions.filter(t => {
                const d = new Date(t.transaction_date);
                return d >= startDate && d <= endDate;
            });

            if (transactions.length === 0) {
                return null; // No hay datos para generar reporte
            }

            // 2. Preparar datos para gráficos
            const incomeByCategory = {};
            const expenseByCategory = {};
            let totalIncome = 0;
            let totalExpense = 0;

            transactions.forEach(t => {
                const amount = parseFloat(t.amount);
                const category = t.category_name || 'Otros';

                if (t.type === 'income') {
                    incomeByCategory[category] = (incomeByCategory[category] || 0) + amount;
                    totalIncome += amount;
                } else {
                    expenseByCategory[category] = (expenseByCategory[category] || 0) + amount;
                    totalExpense += amount;
                }
            });

            // 3. Generar gráficos
            const incomeChartBuffer = await this.generatePieChart(incomeByCategory, 'Ingresos por Categoría');
            const expenseChartBuffer = await this.generatePieChart(expenseByCategory, 'Gastos por Categoría');

            // 4. Crear PDF
            const fileName = `reporte_${userId.replace(/\D/g, '')}_${year}_${month}_${Date.now()}.pdf`;
            const filePath = path.join(__dirname, '../../public/reports', fileName);
            const doc = new PDFDocument({ margin: 50 });

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Encabezado
            doc.fontSize(20).text(`Reporte Financiero - ${this.getMonthName(month)} ${year}`, { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Usuario: ${user.name || userId}`);
            doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-CO')}`);
            doc.moveDown();

            // Resumen
            doc.fontSize(16).text('Resumen General', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12).text(`Ingresos Totales: ${formatCurrency(totalIncome)}`);
            doc.text(`Gastos Totales: ${formatCurrency(totalExpense)}`);
            doc.text(`Balance del Periodo: ${formatCurrency(totalIncome - totalExpense)}`);
            doc.moveDown();

            // Gráficos
            if (Object.keys(incomeByCategory).length > 0) {
                doc.addPage();
                doc.fontSize(16).text('Distribución de Ingresos', { align: 'center' });
                doc.image(incomeChartBuffer, { fit: [500, 300], align: 'center' });
            }

            if (Object.keys(expenseByCategory).length > 0) {
                doc.addPage();
                doc.fontSize(16).text('Distribución de Gastos', { align: 'center' });
                doc.image(expenseChartBuffer, { fit: [500, 300], align: 'center' });
            }

            // Tabla de Movimientos
            doc.addPage();
            doc.fontSize(16).text('Detalle de Movimientos', { underline: true });
            doc.moveDown();

            // Cabecera de tabla simple
            const tableTop = doc.y;
            const itemX = 50;
            const catX = 150;
            const amountX = 400;
            const typeX = 500;

            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Fecha / Descripción', itemX, tableTop);
            doc.text('Categoría', catX, tableTop);
            doc.text('Monto', amountX, tableTop);
            doc.text('Tipo', typeX, tableTop);
            doc.moveDown(0.5);
            doc.font('Helvetica');

            // Filas
            transactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)); // Ordenar por fecha desc

            transactions.forEach((t, i) => {
                const y = doc.y;
                if (y > 700) {
                    doc.addPage();
                }

                const date = new Date(t.transaction_date).toLocaleDateString('es-CO');
                const desc = t.description.substring(0, 20);

                doc.text(`${date} - ${desc}`, itemX, doc.y);
                doc.text(t.category_name || 'Sin categoría', catX, doc.y - 10); // Ajuste leve porque el anterior avanza
                doc.text(formatCurrency(t.amount), amountX, doc.y - 10);
                doc.text(t.type === 'income' ? 'Ingreso' : 'Gasto', typeX, doc.y - 10);
                doc.moveDown(0.5);
            });

            doc.end();

            // Esperar a que se escriba el archivo
            await new Promise((resolve) => stream.on('finish', resolve));

            // Construir URL pública
            // Asumimos que ngrok o el dominio está en config.baseUrl o similar. Si no, usamos localhost para MVP.
            // Para producción se debe configurar una variable BASE_URL.
            const baseUrl = process.env.BASE_URL || `http://localhost:${config.port}`;
            return `${baseUrl}/public/reports/${fileName}`;

        } catch (error) {
            Logger.error('Error generando reporte', error);
            throw error;
        }
    }

    async generatePieChart(data, title) {
        const labels = Object.keys(data);
        const values = Object.values(data);
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
        ];

        const configuration = {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    hoverOffset: 4
                }]
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: title,
                        font: { size: 20 }
                    },
                    legend: {
                        position: 'right'
                    }
                }
            }
        };

        return await this.chartJSNodeCanvas.renderToBuffer(configuration);
    }

    getMonthName(month) {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return months[month - 1];
    }
}

module.exports = new ReportService();
