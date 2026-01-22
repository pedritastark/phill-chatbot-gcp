/**
 * Modelo de transacción financiera (gasto o ingreso)
 */
const { DateTime } = require('luxon');

/**
 * Modelo de transacción financiera Refactorizado
 * Elimina el uso de floats imprecisos y añade soporte de moneda.
 */
class Transaction {
  constructor(data) {
    this.id = data.id || null;
    this.userId = data.userId;
    this.type = data.type; // 'expense' | 'income'

    // 🎯 FIX: Manejo seguro de decimales. 
    // Preferimos string para preservar exactitud '100.50' vs 100.5
    // Postgres convertirá el string mapeado a DECIMAL(12,2) perfectamente.
    this.amount = typeof data.amount === 'number' ? data.amount.toFixed(2) : data.amount;

    this.currency = data.currency || 'COP';
    this.status = data.status || 'completed';

    this.category = data.category || 'otros';
    this.description = data.description || '';

    // 🕒 FIX: Asegurar que las fechas sean objetos Date válidos o ISO strings
    // El modelo guarda el instante exacto (UTC/ISO).
    this.date = data.date ? new Date(data.date).toISOString() : DateTime.now().toUTC().toString();

    this.createdAt = data.createdAt || DateTime.now().toUTC().toString();
  }

  /**
   * Valida integridad básica
   */
  isValid() {
    // Validamos que el montos sea numérico, pero trabajamos con string
    const amountVal = Number(this.amount);
    return (
      this.userId &&
      ['expense', 'income'].includes(this.type) &&
      !isNaN(amountVal) &&
      amountVal > 0 &&
      ['COP', 'USD', 'EUR'].includes(this.currency)
    );
  }

  /**
   * Convierte la transacción a objeto plano
   * @returns {Object}
   */
  toObject() {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      amount: this.amount, // String numérico
      currency: this.currency,
      status: this.status,
      category: this.category,
      description: this.description,
      date: this.date,
      createdAt: this.createdAt,
    };
  }
}

module.exports = Transaction;

