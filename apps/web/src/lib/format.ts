/** Money in whole naira, as the app shows it: ₦1,234,567. */
export const naira = (value: number) => `₦${Math.round(value).toLocaleString('en-NG')}`;

export const num = (value: number, digits = 2) =>
  value.toLocaleString('en-US', { maximumFractionDigits: digits });

/** "₦1.51bn", "₦757.0m": an axis label. */
export function short(value: number): string {
  if (value >= 1e9) return `₦${(value / 1e9).toFixed(2)}bn`;
  if (value >= 1e6) return `₦${(value / 1e6).toFixed(1)}m`;
  return naira(value);
}

/** How long ago: "3 min ago", "9 h ago", "2 days ago". */
export function ago(when: string | number): string {
  const minutes = Math.max(0, (Date.now() - new Date(when).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.floor(minutes)} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  const days = Math.floor(minutes / 60 / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "1 Dec", or "1 Dec 2026" with the year. */
export const day = (date: Date, year = false) =>
  `${date.getDate()} ${MONTHS[date.getMonth()]}${year ? ` ${date.getFullYear()}` : ''}`;
export const monthName = (date: Date, year = true) => `${MONTHS[date.getMonth()]}${year ? ` ${date.getFullYear()}` : ''}`;
/** "Oct 31, 02:14 PM" */
export const stamp = (when: string) =>
  new Date(when).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
