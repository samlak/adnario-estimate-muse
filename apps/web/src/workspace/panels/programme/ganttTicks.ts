import { addDays } from '@/lib/calendar';
import type { ZOOMS } from './constants';

export type Tick = { x: number; label: string; month?: string };

/** The Gantt's scale: every day (Days), each Monday (Weeks) or each month (Months), with the month named on its first. */
export function ticksOf(origin: Date, total: number, px: number, zoom: (typeof ZOOMS)[number]): Tick[] {
  const ticks: Tick[] = [];
  for (let d = 0; d <= total; d++) {
    const date = addDays(origin, d);
    const month = date.getDate() === 1 ? date.toLocaleString('en-US', { month: 'short', year: 'numeric' }) : undefined;
    if (zoom === 'Days') ticks.push({ x: d * px, label: String(date.getDate()), month });
    else if (zoom === 'Weeks' && (date.getDay() === 1 || month)) ticks.push({ x: d * px, label: date.getDay() === 1 ? String(date.getDate()) : '', month });
    else if (zoom === 'Months' && month) ticks.push({ x: d * px, label: '', month });
  }
  return ticks;
}
