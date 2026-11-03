/** The Nigerian working calendar: Monday to Saturday, less the fixed public holidays and Easter (Good Friday, Easter
 * Monday). Eid and Maulud move with the moon, so the QS adds them by hand (`extra`). */

function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), dayOf = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, dayOf);
}

const key = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

function holidays(year: number): Set<string> {
  const e = easter(year);
  const fixed = [[0, 1], [4, 1], [5, 12], [9, 1], [11, 25], [11, 26]].map(([m, d]) => new Date(year, m, d));
  return new Set([...fixed, new Date(year, e.getMonth(), e.getDate() - 2), new Date(year, e.getMonth(), e.getDate() + 1)].map(key));
}

const cache = new Map<number, Set<string>>();
export function isWorking(date: Date, extra: string[] = []): boolean {
  if (date.getDay() === 0) return false;
  const year = date.getFullYear();
  if (!cache.has(year)) cache.set(year, holidays(year));
  return !cache.get(year)!.has(key(date)) && !extra.includes(key(date));
}

export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Working days from start to end, both counted. */
export function workingDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let at = start; at <= end; at = addDays(at, 1)) if (isWorking(at)) days.push(at);
  return days;
}

/** Week N of the programme, counted in calendar weeks from its start. */
export const weekOf = (start: Date, date: Date) => Math.floor((date.getTime() - start.getTime()) / 86400000 / 7) + 1;

export const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
