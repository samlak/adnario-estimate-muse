import { useEffect, useState } from 'react';
import { num } from '@/lib/format';
import { useWs, type Item } from '../../state';

/** A quantity or rate typed in the table itself: saved on Enter or leaving the cell, one step of undo. A measured
 * quantity that was changed shows the measured one beside it. */
export function Edit({ line, field }: { line: Item; field: 'qty' | 'rate' }) {
  const ws = useWs();
  const value = line[field];
  const [text, setText] = useState(value == null ? '' : String(+value.toFixed(field === 'qty' ? 3 : 2)));
  useEffect(() => setText(value == null ? '' : String(+value.toFixed(field === 'qty' ? 3 : 2))), [value, field]);
  const measured = field === 'qty' ? (line as Item & { measured_qty?: number }).measured_qty : undefined;
  const save = () => {
    const next = text.trim() === '' ? null : Number(text.replace(/,/g, ''));
    if (next != null && (Number.isNaN(next) || next < 0)) return setText(value == null ? '' : String(value));
    if (next === value || (field === 'qty' && next == null)) return;
    void ws.edit(field === 'rate' ? { op: 'rate', code: line.code, rate: next } : { op: 'line', code: line.code, qty: next });
  };
  if (!ws.editor) return <span>{value == null ? '' : field === 'qty' ? num(value) : value.toLocaleString('en-NG')}</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <input
        value={text} inputMode="decimal" placeholder={field === 'rate' ? '—' : ''} title={field === 'rate' ? 'Rate (₦): type to change' : 'Quantity: type to change'}
        onClick={(event) => event.stopPropagation()} onChange={(event) => setText(event.target.value)} onBlur={save}
        onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); if (event.key === 'Escape') { setText(value == null ? '' : String(value)); (event.target as HTMLInputElement).blur(); } }}
        className={`w-[74px] rounded border px-1 py-0.5 text-right tabular-nums outline-none focus:border-primary-300 focus:bg-white ${field === 'rate' ? 'border-[#ece6c8] bg-[#fffbea]' : 'border-transparent bg-transparent hover:border-line'} ${measured != null ? 'text-accent-600' : ''}`}
      />
      {measured != null && <small className="text-[10.5px] text-[#9aa1a9]" title="Measured from the model">measured {num(measured)}</small>}
    </span>
  );
}
