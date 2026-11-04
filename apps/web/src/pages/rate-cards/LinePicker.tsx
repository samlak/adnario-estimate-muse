import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { KIND_LABEL, rateOf, type Items, type Line, type Prices, type Rate } from '@/lib/ratecard';

const SHOWN = 60; // choices listed at once; the search finds the rest

/** "Add a line": any price or work item on the card, searched, added at a quantity of 1. */
export function LinePicker({ rate, prices, items, onAdd }: { rate: Rate; prices: Prices; items: Items; onAdd: (line: Line) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const choices = [
    ...[...items.values()].filter((item) => item.code !== rate.code).map((item) => ({ key: `w:${item.code}`, text: item.description, kind: 'Work', price: rateOf(item, prices, items), unit: item.unit, line: { kind: 'WORK', qty: 1, rate: item.code } as Line })),
    ...[...prices.values()].map((price) => ({ key: `p:${price.id}`, text: price.name, kind: KIND_LABEL[price.kind], price: price.price, unit: price.unit, line: { kind: price.kind, qty: 1, price: price.name } as Line })),
  ].filter((choice) => words.every((word) => `${choice.text} ${choice.kind}`.toLowerCase().includes(word)));
  const label = 'Add a line: a price or rate from this card';
  return (
    <div className="relative flex items-center gap-2 pt-2.5">
      <Plus size={15} className="text-[#7b848e]" />
      <button className="flex h-[36px] flex-1 items-center rounded-xl border border-line bg-white px-4 text-left text-[14px]" onClick={() => setOpen(!open)}>
        <span className="flex-1">{label}</span><ChevronDown size={16} className={`text-[#59636e] ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-6 z-50 mb-1 w-[580px] max-w-[90vw] rounded-xl border border-line bg-white shadow-pop">
            <label className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Search size={15} className="text-[#7b848e]" />
              <input autoFocus className="flex-1 text-[14px] outline-none" placeholder="Search…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <ul className="thin-scroll max-h-[340px] overflow-y-auto p-1.5">
              <li className="flex items-center rounded-lg bg-primary-50 px-3 py-2.5 text-[14px] font-semibold text-primary"><span className="flex-1">{label}</span><Check size={16} /></li>
              {choices.slice(0, SHOWN).map((choice) => (
                <li key={choice.key}>
                  <button className="w-full rounded-lg px-3 py-2.5 text-left text-[14px] text-[#3b4652] hover:bg-paper" onClick={() => { setOpen(false); setQuery(''); onAdd(choice.line); }}>
                    {choice.text}{choice.price != null && ` · ₦${choice.price.toLocaleString('en-US')}/${choice.unit}`}
                    <small className="ml-2 text-[11.5px] text-[#9aa1a9]">{choice.kind}</small>
                  </button>
                </li>
              ))}
              {choices.length === 0 && <li className="px-3 py-2.5 text-[13.5px] text-[#6b7581]">Nothing on the card matches “{query}”.</li>}
              {choices.length > SHOWN && <li className="px-3 py-2 text-[12.5px] text-[#9aa1a9]">{choices.length - SHOWN} more: type to find them.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
