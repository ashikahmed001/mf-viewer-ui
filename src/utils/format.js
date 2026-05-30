/**
 * format.js — shared number/currency formatters
 */

/**
 * Format a rupee market value in Lacs (1 Lac = 1,00,000).
 * Returns a string like "₹12.34 L" or "—" for null/undefined.
 *
 * @param {number|null} value  — raw value from the DB (in rupees)
 * @param {number} decimals    — decimal places (default 2)
 */
export function fmtLacs(value, decimals = 2) {
  if (value == null || value === '') return '—';
  const lacs = Number(value) / 1_00_000;
  return `₹${lacs.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} L`;
}

/**
 * Generic number formatter (no currency, no unit).
 */
export function fmtNum(value, decimals = 2) {
  if (value == null || value === '') return '—';
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
