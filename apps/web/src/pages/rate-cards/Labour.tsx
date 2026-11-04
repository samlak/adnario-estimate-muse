import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { gangDays, outputOf, type Prices, type Rate } from '@/lib/ratecard';
import { Cell, toNumber } from './Cell';
import { DASH } from './Dash';
import type { Editing } from './editing';

/** A work item's labour figure from its labour line in days: units a gang-day (8 m³/day) or hours a unit (1 h/m³).
 * Typing it changes the line's gang-days; the basis is how this item shows it. */
export function Labour({ rate, prices, edit }: { rate: Rate; prices: Prices; edit: Editing }) {
  const [choosing, setChoosing] = useState(false);
  const output = outputOf(rate, prices);
  if (!output) return <span className="pl-10">{DASH}</span>;
  const basis = rate.labour_basis;
  const label = (each: typeof basis) => (each === 'day' ? `${rate.unit}/day` : `h/${rate.unit}`);
  const figure = basis === 'day' ? output.perDay : output.hours;
  const type = (text: string) => {
    const value = toNumber(text);
    if (!value) return;
    const lines = rate.lines.map((line, at) => (at === output.at ? { ...line, qty: Math.round(gangDays(value, basis) * 10000) / 10000 } : line));
    edit.change(rate.id, { lines });
  };
  return (
    <span className="relative flex items-center gap-1">
      <span className="w-12"><Cell value={String(figure)} label="Labour figure" number canEdit={edit.canEdit} onSave={type} /></span>
      <button disabled={!edit.canEdit} onClick={() => setChoosing(!choosing)} className={`flex h-[30px] w-[118px] items-center rounded-lg border px-1.5 text-[13px] text-[#59636e] ${choosing ? 'border-line bg-white' : 'border-transparent hover:border-line'}`}>
        <span className="flex-1 text-left">{label(basis)}</span>{edit.canEdit && <ChevronDown size={14} className={choosing ? 'rotate-180' : ''} />}
      </button>
      {choosing && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setChoosing(false)} />
          <ul className="absolute bottom-full left-12 z-50 mb-1 w-[190px] rounded-xl border border-line bg-white p-1 shadow-pop">
            {(['day', 'hour'] as const).map((each) => (
              <li key={each}>
                <button className={`flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[14px] ${each === basis ? 'bg-primary-50 font-semibold' : 'text-[#59636e] hover:bg-paper'}`}
                  onClick={() => { setChoosing(false); if (each !== basis) edit.change(rate.id, { labour_basis: each }); }}>
                  <span className="flex-1">{label(each)}</span>{each === basis && <Check size={15} />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </span>
  );
}
