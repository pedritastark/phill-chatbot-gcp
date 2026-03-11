const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { config } = require('../config/environment');
const Logger = require('../utils/logger');
const { formatCurrency } = require('../utils/formatter');
const TransactionDBService = require('./db/transaction.db.service');
const UserDBService = require('./db/user.db.service');
const AccountDBService = require('./db/account.db.service');
const ReminderDBService = require('./db/reminder.db.service');
const { query } = require('../config/database');

class ReportService {
    constructor() {
        this.width = 800; // Ancho del gráfico
        this.height = 400; // Alto del gráfico
        this.chartCallback = (ChartJS) => {
            ChartJS.defaults.responsive = true;
            ChartJS.defaults.maintainAspectRatio = false;
        };
        this.chartJSNodeCanvas = new ChartJSNodeCanvas({ width: this.width, height: this.height, chartCallback: this.chartCallback });
        this.reportsDir = path.join(__dirname, '../../public/reports');
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    resolvePeriod(period) {
        const now = new Date();
        const type = period?.type || 'current_month';
        let startDate = null;
        let endDate = null;
        let label = 'Mes actual';

        if (type === 'current_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
            label = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        } else if (type === 'last_3_months') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            endDate = now;
            label = 'Ultimos 3 meses';
        } else if (type === 'last_6_months') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            endDate = now;
            label = 'Ultimos 6 meses';
        } else if (type === 'current_year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = now;
            label = `Ano ${now.getFullYear()}`;
        } else if (type === 'custom') {
            startDate = period?.startDate ? new Date(period.startDate) : null;
            endDate = period?.endDate ? new Date(period.endDate) : null;
            label = 'Rango personalizado';
        }

        return { startDate, endDate, label };
    }

    normalizeInclude(include) {
        if (Array.isArray(include)) {
            return new Set(include);
        }
        if (include && typeof include === 'object') {
            return new Set(Object.keys(include).filter((key) => include[key]));
        }
        return new Set(['summary', 'transactions', 'accounts', 'goals', 'reminders', 'debts']);
    }

    async generateCustomReport({ user, options }) {
        const include = this.normalizeInclude(options?.include);
        const detailLevel = options?.detailLevel || 'detailed';
        const includeCharts = options?.includeCharts !== false;
        const branding = options?.branding !== false;
        const filters = options?.filters || {};
        const typeFilter = filters.type && filters.type !== 'all' ? filters.type : null;
        const accountIds = Array.isArray(filters.accountIds) ? filters.accountIds : [];
        const categoryIds = Array.isArray(filters.categoryIds) ? filters.categoryIds : [];

        const { startDate, endDate, label } = this.resolvePeriod(options?.period || {});

        const needsTransactions = include.has('summary') || include.has('transactions') || includeCharts;
        let transactions = [];

        if (needsTransactions) {
            const txFilters = { limit: 5000 };
            if (typeFilter) txFilters.type = typeFilter;
            if (startDate) txFilters.startDate = startDate.toISOString();
            if (endDate) txFilters.endDate = endDate.toISOString();

            const allTx = await TransactionDBService.findByUser(user.user_id, txFilters);
            transactions = allTx.filter((t) => {
                const accountOk = accountIds.length === 0 || accountIds.includes(t.account_id);
                const categoryOk = categoryIds.length === 0 || categoryIds.includes(t.category_id);
                return accountOk && categoryOk;
            });
        }

        let accounts = [];
        if (include.has('accounts')) {
            accounts = await AccountDBService.findByUser(user.user_id);
            if (accountIds.length > 0) {
                accounts = accounts.filter((a) => accountIds.includes(a.account_id));
            }
        }

        let goals = [];
        if (include.has('goals')) {
            const result = await query(
                `SELECT * FROM financial_goals
                 WHERE user_id = $1 AND status IN ('active', 'completed')
                 ORDER BY priority DESC, target_date ASC`,
                [user.user_id]
            );
            goals = result.rows;
        }

        let reminders = [];
        if (include.has('reminders')) {
            reminders = await ReminderDBService.getByUser(user.user_id);
            if (startDate || endDate) {
                reminders = reminders.filter((r) => {
                    if (!r.scheduled_at) return false;
                    const d = new Date(r.scheduled_at);
                    if (startDate && d < startDate) return false;
                    if (endDate && d > endDate) return false;
                    return true;
                });
            }
        }

        let debts = [];
        if (include.has('debts')) {
            const result = await query(
                `SELECT * FROM debts
                 WHERE user_id = $1 AND status IN ('active', 'paid_off')
                 ORDER BY status ASC, created_at DESC`,
                [user.user_id]
            );
            debts = result.rows;
        }

        const totalIncome = transactions.reduce((sum, t) => sum + (t.type === 'income' ? Number(t.amount || 0) : 0), 0);
        const totalExpense = transactions.reduce((sum, t) => sum + (t.type === 'expense' ? Number(t.amount || 0) : 0), 0);

        const incomeByCategory = {};
        const expenseByCategory = {};
        if (includeCharts && transactions.length > 0) {
            transactions.forEach((t) => {
                const amount = Number(t.amount || 0);
                const category = t.category_name || 'Otros';
                if (t.type === 'income') {
                    incomeByCategory[category] = (incomeByCategory[category] || 0) + amount;
                } else {
                    expenseByCategory[category] = (expenseByCategory[category] || 0) + amount;
                }
            });
        }

        const fileName = `export_${user.user_id}_${Date.now()}.pdf`;
        const filePath = path.join(this.reportsDir, fileName);

        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        if (branding) {
            doc.save();
            doc.rect(0, 0, doc.page.width, 50).fill('#2b0d4a');
            doc.fillColor('#ffffff').fontSize(16).text('Phill', 50, 18);
            doc.restore();
            doc.moveDown(2);
        }

        doc.fontSize(18).fillColor('#111111').text('Reporte financiero', { align: 'left' });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#4B5563');
        doc.text(`Usuario: ${user.name || user.phone_number}`);
        doc.text(`Periodo: ${label}`);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`);
        doc.moveDown();

        if (include.has('summary')) {
            doc.fontSize(14).fillColor('#111111').text('Resumen general', { underline: true });
            doc.moveDown(0.4);
            doc.fontSize(11).fillColor('#111111');
            doc.text(`Ingresos: ${formatCurrency(totalIncome)}`);
            doc.text(`Gastos: ${formatCurrency(totalExpense)}`);
            doc.text(`Balance: ${formatCurrency(totalIncome - totalExpense)}`);
            doc.text(`Movimientos: ${transactions.length}`);
            doc.moveDown();
        }

        if (includeCharts) {
            if (Object.keys(incomeByCategory).length > 0) {
                const incomeChart = await this.generatePieChart(incomeByCategory, 'Ingresos por categoria');
                doc.addPage();
                doc.fontSize(14).fillColor('#111111').text('Distribucion de ingresos', { align: 'center' });
                doc.image(incomeChart, { fit: [500, 300], align: 'center' });
            }
            if (Object.keys(expenseByCategory).length > 0) {
                const expenseChart = await this.generatePieChart(expenseByCategory, 'Gastos por categoria');
                doc.addPage();
                doc.fontSize(14).fillColor('#111111').text('Distribucion de gastos', { align: 'center' });
                doc.image(expenseChart, { fit: [500, 300], align: 'center' });
            }
        }

        if (include.has('transactions')) {
            doc.addPage();
            doc.fontSize(14).fillColor('#111111').text('Movimientos', { underline: true });
            doc.moveDown(0.5);

            if (detailLevel === 'summary') {
                doc.fontSize(11).text(`Total ingresos: ${formatCurrency(totalIncome)}`);
                doc.text(`Total gastos: ${formatCurrency(totalExpense)}`);
                doc.text(`Cantidad de movimientos: ${transactions.length}`);
            } else {
                const tableTop = doc.y;
                const itemX = 50;
                const catX = 190;
                const amountX = 400;
                const typeX = 500;

                doc.fontSize(10).font('Helvetica-Bold');
                doc.text('Fecha / Descripcion', itemX, tableTop);
                doc.text('Categoria', catX, tableTop);
                doc.text('Monto', amountX, tableTop);
                doc.text('Tipo', typeX, tableTop);
                doc.moveDown(0.5);
                doc.font('Helvetica');

                const sorted = [...transactions].sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
                sorted.forEach((t) => {
                    if (doc.y > 700) {
                        doc.addPage();
                    }
                    const date = new Date(t.transaction_date).toLocaleDateString('es-CO');
                    const desc = (t.description || 'Sin descripcion').substring(0, 24);
                    doc.text(`${date} - ${desc}`, itemX, doc.y);
                    doc.text(t.category_name || 'Sin categoria', catX, doc.y - 10);
                    doc.text(formatCurrency(t.amount), amountX, doc.y - 10);
                    doc.text(t.type === 'income' ? 'Ingreso' : 'Gasto', typeX, doc.y - 10);
                    doc.moveDown(0.5);
                });
            }
            doc.moveDown();
        }

        if (include.has('accounts')) {
            doc.addPage();
            doc.fontSize(14).fillColor('#111111').text('Cuentas y saldos', { underline: true });
            doc.moveDown(0.5);
            accounts.forEach((acc) => {
                doc.fontSize(11).text(`${acc.name} (${acc.type}) - ${formatCurrency(acc.balance || 0)}`);
            });
            if (accounts.length === 0) {
                doc.fontSize(11).text('No hay cuentas registradas.');
            }
        }

        if (include.has('goals')) {
            doc.addPage();
            doc.fontSize(14).fillColor('#111111').text('Metas y ahorros', { underline: true });
            doc.moveDown(0.5);
            goals.forEach((g) => {
                doc.fontSize(11).text(`${g.name} - ${formatCurrency(g.current_amount)} / ${formatCurrency(g.target_amount)}`);
            });
            if (goals.length === 0) {
                doc.fontSize(11).text('No hay metas registradas.');
            }
        }

        if (include.has('reminders')) {
            doc.addPage();
            doc.fontSize(14).fillColor('#111111').text('Recordatorios', { underline: true });
            doc.moveDown(0.5);
            reminders.forEach((r) => {
                const date = r.scheduled_at ? new Date(r.scheduled_at).toLocaleDateString('es-CO') : 'Sin fecha';
                doc.fontSize(11).text(`${date} - ${r.message || 'Recordatorio'} (${r.completion_status})`);
            });
            if (reminders.length === 0) {
                doc.fontSize(11).text('No hay recordatorios en este periodo.');
            }
        }

        if (include.has('debts')) {
            doc.addPage();
            doc.fontSize(14).fillColor('#111111').text('Deudas', { underline: true });
            doc.moveDown(0.5);
            debts.forEach((d) => {
                const remaining = d.remaining_amount || d.remainingAmount || 0;
                const monthly = d.monthly_payment || d.monthlyPayment || 0;
                doc.fontSize(11).text(`${d.name} - Pendiente: ${formatCurrency(remaining)} - Cuota: ${formatCurrency(monthly)}`);
            });
            if (debts.length === 0) {
                doc.fontSize(11).text('No hay deudas registradas.');
            }
        }

        doc.end();
        await new Promise((resolve) => stream.on('finish', resolve));

        const baseUrl = process.env.BASE_URL || `http://localhost:${config.port}`;
        return `${baseUrl}/public/reports/${fileName}`;
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
