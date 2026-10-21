/**
 * Formats a date string, date object, or timestamp into the Indonesian locale format (DD/MM/YYYY).
 * Returns "-" if the date value is falsy or invalid.
 * 
 * @param value - The date value to format
 * @returns The formatted date string
 */
export function formatDate(value: any): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("id-ID");
}
