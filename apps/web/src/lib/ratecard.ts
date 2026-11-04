/** The firm's rate card, from the API (its copy of Adnario Market Rates). A rate is the sum of its build-up lines
 * (quantity × price) plus the percentage additions, to the naira; a line whose price is missing leaves it blank. A
 * WORK line is a quantity of another item at its rate (which has its own additions), added after the additions.
 * The server works the rates out too; the page does it again so a typed price shows at once. */
import { useApi } from '@/lib/store';

export type Kind = 'MATERIAL' | 'LABOUR' | 'PLANT';
export type Price = { id: string; name: string; kind: Kind; unit: string; price: number | null; as_of: string; note: string };
export type Line = { kind: Kind | 'WORK'; qty: number; price?: string; rate?: string; description?: string; unit?: string; own_price?: number };
export type Rate = {
  id: string;
  code: string;
  section: string;
  description: string;
  unit: string;
  lines: Line[];
  additions: { material: number; labour: number; risk: number };
  price: number | null; // a typed rate, for an item with no build-up
  labour_basis: Basis;
};
export type Basis = 'day' | 'hour'; // labour shown as units a gang-day, or hours a unit (a gang-day is 8 hours)
export type Row = { id: string; kind: Kind | 'RATE'; code: string | null; section: string | null; name: string; unit: string; price: number | null; lines: Line[] | null; additions: Rate['additions'] | null; labour_basis: Basis; as_of: string; note: string };
export type Card = { id: string; name: string; prices_of: string; rows: Row[] };
export type Prices = Map<string, Price>;
export type Items = Map<string, Rate>; // work items by code, for WORK lines

export function useCard() {
  const { data: card } = useApi<Card>('/ratecards');
  const rows = card?.rows ?? [];
  const PRICES: Price[] = rows.filter((row) => row.kind !== 'RATE').map((row) => ({ ...row, kind: row.kind as Kind }));
  const RATES: Rate[] = rows
    .filter((row) => row.kind === 'RATE')
    .map((row) => ({ id: row.id, code: row.code ?? '', section: row.section ?? '', description: row.name, unit: row.unit, lines: row.lines ?? [], additions: row.additions ?? { material: 0, labour: 0, risk: 0 }, price: row.price, labour_basis: row.labour_basis ?? 'day' }));
  const prices: Prices = new Map(PRICES.map((each) => [each.name, each]));
  const items: Items = new Map(RATES.map((each) => [each.code, each]));
  return { card, PRICES, RATES, prices, items };
}

/** One build-up line: its name, unit, unit price and amount (null when its price is missing). */
export function lineOf(line: Line, prices: Prices, items?: Items, seen: string[] = []) {
  if (line.kind === 'WORK') {
    const other = line.rate ? items?.get(line.rate) : undefined;
    const unitPrice = other && !seen.includes(other.code) ? rateOf(other, prices, items, seen) : null;
    return { name: other ? `${other.code} ${other.description}` : line.description ?? line.rate ?? '', unit: other?.unit ?? '', kind: line.kind, qty: line.qty, unitPrice, amount: unitPrice == null ? null : line.qty * unitPrice };
  }
  const name = line.price ?? line.description ?? '';
  const unitPrice = line.price ? (prices.get(line.price)?.price ?? null) : (line.own_price ?? null);
  const unit = line.unit ?? prices.get(name)?.unit ?? '';
  return { name, unit, kind: line.kind, qty: line.qty, unitPrice, amount: unitPrice == null ? null : line.qty * unitPrice };
}

export function rateOf(rate: Rate, prices: Prices, items?: Items, seen: string[] = []): number | null {
  if (!rate.lines.length) return rate.price ?? null; // typed, with no build-up
  const sums = { MATERIAL: 0, LABOUR: 0, PLANT: 0, WORK: 0 };
  for (const line of rate.lines) {
    const { amount } = lineOf(line, prices, items, [...seen, rate.code]);
    if (amount == null) return null; // nothing is guessed
    sums[line.kind] += amount;
  }
  const { additions } = rate;
  const sum = sums.MATERIAL * (1 + additions.material / 100) + sums.LABOUR * (1 + additions.labour / 100) + sums.PLANT;
  return Math.round(sum * (1 + additions.risk / 100) + sums.WORK);
}

/** Labour lines in days give the item its output per gang-day: 0.125 gang-days a m³ is 8 m³/day, or 1 h/m³. `at` is
 * the line's place in the build-up, to change it. */
export function outputOf(rate: Rate, prices: Prices): { perDay: number; hours: number; gang: string; at: number } | null {
  const at = rate.lines.findIndex((line) => line.kind === 'LABOUR' && !!line.price && !!line.qty && ['day', 'gang-day'].includes(prices.get(line.price)?.unit ?? ''));
  if (at < 0) return null;
  const line = rate.lines[at];
  return { perDay: Math.round((1 / line.qty) * 100) / 100, hours: Math.round(line.qty * HOURS * 100) / 100, gang: `1 ${line.price!.toLowerCase()}`, at };
}

/** The labour line's gang-days a unit, from the figure as typed: units a day, or hours a unit. */
export const gangDays = (figure: number, basis: Basis) => (basis === 'day' ? 1 / figure : figure / HOURS);

const HOURS = 8; // a gang-day

export const KIND_LABEL: Record<Kind | 'WORK', string> = { MATERIAL: 'Material', LABOUR: 'Labour', PLANT: 'Plant', WORK: 'Work' };
