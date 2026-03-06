/**
 * Date Utilities
 * Helper functions for safe date manipulation, especially for edge cases like February
 */

/**
 * Safely add months to a date, handling edge cases like February 29/30/31
 * @param {Date} date - The base date
 * @param {number} months - Number of months to add
 * @returns {Date} - New date with months added, adjusted for month boundaries
 *
 * Examples:
 * - January 31 + 1 month = February 28/29 (not March 2/3)
 * - January 30 + 1 month = February 28/29
 * - August 31 + 1 month = September 30 (not October 1)
 */
function addMonthsSafe(date, months) {
    const result = new Date(date);
    const originalDay = result.getDate();

    // Add months
    result.setMonth(result.getMonth() + months);

    // If the day changed (e.g., Jan 31 -> Mar 3), it means we overflowed
    // Set to last day of the previous month
    if (result.getDate() !== originalDay) {
        result.setDate(0); // Sets to last day of previous month
    }

    return result;
}

/**
 * Build a date for a specific day of month, handling February edge cases
 * @param {number} day - Day of month (1-31)
 * @param {Date} baseDate - Base date to calculate from (defaults to now)
 * @returns {Date} - Date with the specified day, adjusted if needed
 *
 * Examples:
 * - buildDateForDay(31, Feb 15 2024) = Feb 29 2024 (leap year)
 * - buildDateForDay(31, Feb 15 2025) = Feb 28 2025 (non-leap)
 * - buildDateForDay(15, Feb 10 2024) = Feb 15 2024
 */
function buildDateForDay(day, baseDate = new Date()) {
    const result = new Date(baseDate);

    // Try to set the day
    result.setDate(day);

    // If we overflowed to next month, set to last day of target month
    if (result.getDate() !== day) {
        result.setDate(0); // Last day of previous month (which is our target month)
    }

    return result;
}

/**
 * Get the last day of a specific month
 * @param {number} year - Year
 * @param {number} month - Month (0-11, JavaScript convention)
 * @returns {number} - Last day of the month (28-31)
 */
function getLastDayOfMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Build next occurrence of a monthly recurring date
 * Handles edge cases where the day doesn't exist in target month
 * @param {number} dayOfMonth - Target day of month (1-31)
 * @param {Date} fromDate - Date to calculate from (defaults to now)
 * @returns {Date} - Next occurrence of that day, adjusted for month boundaries
 */
function buildNextMonthlyDate(dayOfMonth, fromDate = new Date()) {
    const now = fromDate;
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Try current month first
    const lastDayThisMonth = getLastDayOfMonth(currentYear, currentMonth);
    const adjustedDay = Math.min(dayOfMonth, lastDayThisMonth);
    let candidate = new Date(currentYear, currentMonth, adjustedDay, 9, 0, 0);

    // If candidate is in the past, try next month
    if (candidate <= now) {
        const nextMonth = currentMonth + 1;
        const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
        const nextMonthIndex = nextMonth > 11 ? 0 : nextMonth;

        const lastDayNextMonth = getLastDayOfMonth(nextYear, nextMonthIndex);
        const adjustedDayNext = Math.min(dayOfMonth, lastDayNextMonth);

        candidate = new Date(nextYear, nextMonthIndex, adjustedDayNext, 9, 0, 0);
    }

    return candidate;
}

/**
 * Check if a year is a leap year
 * @param {number} year - Year to check
 * @returns {boolean} - True if leap year
 */
function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

module.exports = {
    addMonthsSafe,
    buildDateForDay,
    getLastDayOfMonth,
    buildNextMonthlyDate,
    isLeapYear
};
