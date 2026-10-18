/**
 * Formats a number into Naira string with comma separators.
 * e.g., 12500 -> "₦12,500" or without symbol: "12,500"
 */
export function formatNaira(value, showSymbol = true) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return showSymbol ? '₦0' : '0';
  }
  const num = Math.round(Number(value) * 100) / 100;
  const parts = num.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = parts.join('.');
  return showSymbol ? `₦${formatted}` : formatted;
}

/**
 * Parses user input string into valid positive number or 0
 */
export function parseNumber(val) {
  if (typeof val === 'number') return Math.max(0, val);
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}
