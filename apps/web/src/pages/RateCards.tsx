/** Rate cards (README §6): the firm's copy of Adnario Market Rates, edited in place. Rows are work items (with their
 * build-ups) or prices (material, labour, plant). Change a price and every rate built on it changes. */
import { ChevronDown, ChevronRight, Pencil, Search } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { KIND_LABEL, lineOf, outputOf, rateOf, useCard, type Items, type Kind, type Price, type Prices, type Rate } from '@/lib/ratecard';
import { num } from '@/lib/format';
import { put, send } from '@/lib/store';

type Tab = 'all' | 'rates' | Kind;
const DASH = <span className="text-[#b5bbc1]">—</span>;

export function RateCards() {
  const { card, PRICES, RATES, prices, items } = useCard();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const words = query.toLowerCase().trim();

  const groups = useMemo(() => {
    const out: { title: string; rates?: Rate[]; prices?: Price[] }[] = [];
    if (tab === 'all' || tab === 'rates') {
      // in the card's own order: a heading each time the section changes
      for (const rate of RATES.filter((each) => `${each.code} ${each.description} ${each.section}`.toLowerCase().includes(words))) {
        const last = out[out.length - 1];
        if (last?.title === rate.section) last.rates!.push(rate);
        else out.push({ title: rate.section, rates: [rate] });
      }
    }
    for (const kind of ['MATERIAL', 'LABOUR', 'PLANT'] as Kind[]) {
      if (tab !== 'all' && tab !== kind) continue;
      const prices = PRICES.filter((price) => price.kind === kind && price.name.toLowerCase().includes(words)).sort((a, b) => (a.name < b.name ? -1 : 1));
      if (prices.length) out.push({ title: KIND_LABEL[kind], prices });
    }
    return out;
  }, [tab, words, PRICES, RATES]);

  const count = (kind: Kind) => PRICES.filter((price) => price.kind === kind).length;
  const tabs: [Tab, string][] = [
    ['all', `All ${RATES.length + PRICES.length}`], ['rates', `Rates ${RATES.length}`],
    ['MATERIAL', `Material ${count('MATERIAL')}`], ['LABOUR', `Labour ${count('LABOUR')}`], ['PLANT', `Plant ${count('PLANT')}`],
  ];
  // shown at once, then saved; every rate built on the price follows
  const editPrice = (price: Price, value: number) => {
    if (card) put('/ratecards', { ...card, rows: card.rows.map((row) => (row.id === price.id ? { ...row, price: value } : row)) });
    void send(`/raterows/${price.id}`, 'PATCH', { price: value }, '/ratecards');
  };
  if (!card) return null;

  return (
    <div className="pt-[11px]">
      <div className="flex items-center gap-3">
        {naming ? (
          <input
            autoFocus
            className="input h-9 w-72 text-[19px] font-bold"
            defaultValue={card.name}
            onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== card.name) void send(`/ratecards/${card.id}`, 'PATCH', { name }, '/ratecards'); setNaming(false); }}
            onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
          />
        ) : (
          <h2 className="text-[19px] font-bold tracking-[-0.01em]">{card.name}</h2>
        )}
        <button title="Rename" onClick={() => setNaming(true)} className="text-[#7b848e]"><Pencil size={16} /></button>
        <span className="ml-5 text-[13.5px] text-[#7b848e]">prices of {new Date(card.prices_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {RATES.length + PRICES.length} rows</span>
      </div>
      <div className="mt-[21px] flex items-center gap-3.5">
        <div className="flex rounded-xl bg-canvas p-1">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`h-[32px] rounded-lg px-3 text-[13.5px] ${tab === id ? 'bg-white font-semibold shadow-sm' : 'text-[#59636e]'}`}>{label}</button>
          ))}
        </div>
        <label className="relative w-full max-w-[338px]">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a929b]" />
          <input className="input h-[40px] pl-10" placeholder="Search rows" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
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
                {group.rates?.map((rate) => {
                  const value = rateOf(rate, prices, items);
                  const output = outputOf(rate, prices);
                  const expanded = open === rate.code;
                  return (
                    <Fragment key={rate.code}>
                      <tr className="h-[40.6px] cursor-pointer border-b border-line hover:bg-paper/60" onClick={() => setOpen(expanded ? null : rate.code)}>
                        <td className="px-3">{rate.code}</td>
                        <td className="truncate pr-3"><span className="inline-flex w-7 text-[#7b848e]">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>{rate.description}</td>
                        <td className="px-3">{rate.unit}</td>
                        <td className="px-3 text-right">{value == null ? DASH : value.toLocaleString('en-US')}</td>
                        <td className="pl-6 pr-3">
                          {output ? (
                            <span className="flex items-center gap-3">
                              <span className="w-8 text-right">{num(output.perDay)}</span>
                              <span className="flex items-center gap-1 text-[13px] text-[#59636e]">{rate.unit}/day <ChevronDown size={14} className="ml-6" /></span>
                            </span>
                          ) : <span className="pl-10">{DASH}</span>}
                        </td>
                        <td className="truncate px-3">{output?.gang ?? DASH}</td>
                      </tr>
                      {expanded && <BuildUp rate={rate} value={value} prices={prices} items={items} />}
                    </Fragment>
                  );
                })}
                {group.prices?.map((price) => (
                  <tr key={price.name} className="h-[40.6px] border-b border-line">
                    <td className="px-3">{DASH}</td>
                    <td className="truncate pr-3" title={price.note || price.name}>{price.name}</td>
                    <td className="truncate px-3">{price.unit}</td>
                    <td className="px-3 text-right"><PriceCell value={price.price} onChange={(value) => editPrice(price, value)} /></td>
                    <td className="pl-6 text-[#b5bbc1]">–</td>
                    <td className="px-3">{DASH}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        {groups.length === 0 && <p className="p-8 text-center text-sm text-[#6b7581]">No rows match “{query}”.</p>}
      </div>
    </div>
  );
}

/** A price, typed over in place. */
function PriceCell({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return <button className="hover:text-primary" onClick={() => setEditing(true)}>{value == null ? DASH : value.toLocaleString('en-US')}</button>;
  return (
    <input
      autoFocus
      type="number"
      min={0}
      className="h-7 w-24 rounded border border-primary-300 px-1.5 text-right"
      defaultValue={value ?? ''}
      onBlur={(event) => { const next = Number(event.target.value); if (event.target.value !== '' && next >= 0 && next !== value) onChange(next); setEditing(false); }}
      onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
    />
  );
}

/** A work item's recipe: a quantity of each price, then the percentage additions. */
function BuildUp({ rate, value, prices, items }: { rate: Rate; value: number | null; prices: Prices; items: Items }) {
  const { additions } = rate;
  return (
    <tr className="border-b border-line bg-paper/70">
      <td />
      <td colSpan={5} className="py-3 pr-6">
        <table className="w-full text-[13px]">
          <thead><tr className="text-[11px] uppercase tracking-[0.08em] text-[#7b848e]"><th className="py-1 text-left font-semibold">Build-up</th><th className="text-right font-semibold">Qty</th><th className="pl-3 text-left font-semibold">Unit</th><th className="text-right font-semibold">Price</th><th className="text-right font-semibold">Amount</th></tr></thead>
          <tbody>
            {rate.lines.map((line, index) => {
              const shown = lineOf(line, prices, items);
              return (
                <tr key={index} className="border-t border-line/70">
                  <td className="py-1.5"><span className="mr-2 font-mono text-[11px] text-[#9aa1a9]">{KIND_LABEL[line.kind]}</span>{shown.name}</td>
                  <td className="text-right font-mono">{num(line.qty, 4)}</td>
                  <td className="pl-3">{shown.unit}</td>
                  <td className="text-right font-mono">{shown.unitPrice == null ? <span className="text-danger">no price</span> : shown.unitPrice.toLocaleString('en-US')}</td>
                  <td className="text-right font-mono">{shown.amount == null ? DASH : Math.round(shown.amount).toLocaleString('en-US')}</td>
                </tr>
              );
            })}
            <tr className="border-t border-line text-[#59636e]">
              <td className="py-1.5" colSpan={4}>Additions: material {additions.material}%, labour {additions.labour}%, risk {additions.risk}%</td>
              <td className="text-right font-mono font-semibold text-ink">{value == null ? 'blank' : `₦${value.toLocaleString('en-US')}`}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}
