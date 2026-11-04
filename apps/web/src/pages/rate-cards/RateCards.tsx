/** Rate cards (README §6): the firm's copy of Adnario Market Rates, edited in place. Rows are work items (with their
 * build-ups) or prices (material, labour, plant). Change a price and every rate built on it changes. */
import { Fragment, useMemo, useState } from 'react';
import { useCard, type Price } from '@/lib/ratecard';
import { put, send } from '@/lib/store';
import { CardTitle } from './CardTitle';
import { groupsOf, tabsOf, type Tab } from './groups';
import { PriceRow } from './PriceRow';
import { RateRow } from './RateRow';
import { RateTabs } from './RateTabs';

export function RateCards() {
  const { card, PRICES, RATES, prices, items } = useCard();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const groups = useMemo(() => groupsOf(tab, query, RATES, PRICES), [tab, query, PRICES, RATES]);

  // shown at once, then saved; every rate built on the price follows
  const editPrice = (price: Price, value: number) => {
    if (card) put('/ratecards', { ...card, rows: card.rows.map((row) => (row.id === price.id ? { ...row, price: value } : row)) });
    void send(`/raterows/${price.id}`, 'PATCH', { price: value }, '/ratecards');
  };
  if (!card) return null;

  return (
    <div className="pt-[11px]">
      <CardTitle name={card.name} pricesOf={card.prices_of} rows={RATES.length + PRICES.length} onRename={(name) => void send(`/ratecards/${card.id}`, 'PATCH', { name }, '/ratecards')} />
      <RateTabs tabs={tabsOf(RATES, PRICES)} tab={tab} setTab={setTab} query={query} setQuery={setQuery} />
      <div className="card mt-3.5 overflow-hidden">
        <table className="w-full table-fixed text-[14px]">
          <colgroup><col className="w-[102px]" /><col /><col className="w-[100px]" /><col className="w-[118px]" /><col className="w-[186px]" /><col className="w-[268px]" /></colgroup>
          <thead className="border-b border-line">
            <tr><th className="th pl-3">Code</th><th className="th">Description</th><th className="th">Unit</th><th className="th text-right">Rate (₦)</th><th className="th pl-6">Labour</th><th className="th">Gang</th></tr>
          </thead>
          <tbody>
            {groups.map((group, index) => (
              <Fragment key={`${index}-${group.title}`}>
                <tr className="border-b border-line bg-[#f7f9fb]"><td colSpan={6} className="px-3 py-2.5 text-[14px] font-bold">{group.title}</td></tr>
                {group.rates?.map((rate) => (
                  <RateRow key={rate.code} rate={rate} prices={prices} items={items} expanded={open === rate.code} onToggle={() => setOpen(open === rate.code ? null : rate.code)} />
                ))}
                {group.prices?.map((price) => <PriceRow key={price.name} price={price} onPrice={(value) => editPrice(price, value)} />)}
              </Fragment>
            ))}
          </tbody>
        </table>
        {groups.length === 0 && <p className="p-8 text-center text-sm text-[#6b7581]">No rows match “{query}”.</p>}
      </div>
    </div>
  );
}
