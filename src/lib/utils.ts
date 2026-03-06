import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string as MM/DD/YYYY without timezone impact.
 * Uses UTC components to prevent day-shifting caused by local timezone conversion.
 * Returns '-' for falsy/invalid inputs.
 */
export function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '-';
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Convert any date to YYYY-MM-DD format for HTML <input type="date"> elements.
 * Uses UTC components to prevent timezone day-shift.
 * Returns '' for falsy/invalid inputs.
 */
export function toDateInputValue(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  // If already in YYYY-MM-DD format, return as-is
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
