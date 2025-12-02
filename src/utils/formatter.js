/**
 * Formatea un número como moneda colombiana (COP)
 * @param {number} amount - Monto a formatear
 * @returns {string} - Cadena formateada (ej: $1.000.000)
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

module.exports = {
    formatCurrency
};
