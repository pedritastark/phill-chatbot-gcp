/**
 * Formatea un número como moneda
 * @param {number} amount - Monto a formatear
 * @param {string} currency - Código de moneda (COP, USD, EUR) - Default: COP
 * @returns {string} - Cadena formateada
 */
function formatCurrency(amount, currency = 'COP') {
    const resolvedCurrency = String(currency || 'COP').toUpperCase();
    // Use a consistent locale; currency code controls symbol/formatting.
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: resolvedCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

module.exports = {
    formatCurrency
};
