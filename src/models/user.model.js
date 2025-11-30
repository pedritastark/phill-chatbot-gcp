/**
 * Modelo de usuario
 */
class User {
  constructor(data) {
    this.id = data.id || null;
    this.phoneNumber = data.phoneNumber;
    this.name = data.name || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.lastInteraction = data.lastInteraction || new Date().toISOString();
  }

  /**
   * Valida que el usuario sea válido
   * @returns {boolean}
   */
  isValid() {
    return this.phoneNumber && this.phoneNumber.length > 0;
  }

  /**
   * Convierte el usuario a objeto plano
   * @returns {Object}
   */
  toObject() {
    return {
      id: this.id,
      phoneNumber: this.phoneNumber,
      name: this.name,
      createdAt: this.createdAt,
      lastInteraction: this.lastInteraction,
    };
  }
}

module.exports = User;

