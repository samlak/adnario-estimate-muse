import { KIND_LABEL, type Kind, type Price, type Rate } from '@/lib/ratecard';

export type Tab = 'all' | 'rates' | Kind;
export type Group = { title: string; rates?: Rate[]; prices?: Price[] };

/** The rows a tab and a search show: work items in the card's own order with a heading each time the section changes,
 * then each kind of price, A to Z. */
export function groupsOf(tab: Tab, query: string, rates: Rate[], prices: Price[]): Group[] {
  const words = query.toLowerCase().trim();
  const out: Group[] = [];
  if (tab === 'all' || tab === 'rates') {
    for (const rate of rates.filter((each) => `${each.code} ${each.description} ${each.section}`.toLowerCase().includes(words))) {
      const last = out[out.length - 1];
      if (last?.title === rate.section) last.rates!.push(rate);
      else out.push({ title: rate.section, rates: [rate] });
    }
  }
  for (const kind of ['MATERIAL', 'LABOUR', 'PLANT'] as Kind[]) {
    if (tab !== 'all' && tab !== kind) continue;
    const found = prices.filter((price) => price.kind === kind && price.name.toLowerCase().includes(words)).sort((a, b) => (a.name < b.name ? -1 : 1));
    if (found.length) out.push({ title: KIND_LABEL[kind], prices: found });
  }
  return out;
}

/** Each tab with its count of rows. */
export function tabsOf(rates: Rate[], prices: Price[]): [Tab, string][] {
  const count = (kind: Kind) => prices.filter((price) => price.kind === kind).length;
  return [
    ['all', `All ${rates.length + prices.length}`], ['rates', `Rates ${rates.length}`],
    ['MATERIAL', `Material ${count('MATERIAL')}`], ['LABOUR', `Labour ${count('LABOUR')}`], ['PLANT', `Plant ${count('PLANT')}`],
  ];
}
