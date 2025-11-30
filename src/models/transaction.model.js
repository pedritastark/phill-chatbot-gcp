/**
 * Modelo de transacción financiera (gasto o ingreso)
 */
class Transaction {
  constructor(data) {
    this.id = data.id || null;
    this.userId = data.userId;
    this.type = data.type; // 'expense' o 'income'
    this.amount = parseFloat(data.amount);
    this.category = data.category || 'otros';
    this.description = data.description || '';
    this.date = data.date || new Date().toISOString();
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  /**
   * Valida que la transacción sea válida
   * @returns {boolean}
   */
  isValid() {
    return (
      this.userId &&
      ['expense', 'income'].includes(this.type) &&
      !isNaN(this.amount) &&
      this.amount > 0
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
      amount: this.amount,
      category: this.category,
      description: this.description,
      date: this.date,
      createdAt: this.createdAt,
    };
  }
}

module.exports = Transaction;

