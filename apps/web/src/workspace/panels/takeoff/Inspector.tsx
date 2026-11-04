import { X } from 'lucide-react';
import { naira, num } from '@/lib/format';
import { useWs, type Item, type Result } from '../../state';

/** A BOQ item opened: its rate and where it came from, the measured lines in it, its elements in 3D. */
export function Inspector({ line, result }: { line: Item; result: Result }) {
  const ws = useWs();
  const source = line.rate_item_id ? result.pricing.sources?.[line.rate_item_id] : undefined;
  const parts = result.takeoff_lines.filter((each) => line.lines.includes(each.code));
  return (
    <section className="mb-3 rounded-xl border border-primary-200 bg-primary-50/40 px-3 py-2.5 text-[12px]">
      <div className="flex items-start gap-2">
        <b className="flex-1 text-[12.5px]">{result.refs[line.code]} {line.description}</b>
        <button onClick={() => ws.setLine(null)} title="Close"><X size={14} className="text-[#7b848e]" /></button>
      </div>
      <p className="mt-1 text-[#59636e]">{line.qty == null ? '' : `${num(line.qty)} ${line.unit}`} · {line.count} elements · confidence {line.confidence}</p>
      {ws.money && <p className="mt-1 text-[#59636e]">{line.rate != null && line.qty != null ? `Amount ${naira(line.rate * line.qty)}. ` : ''}{source ? `From ${source.card}: ${source.code} ${source.description}` : line.rate_note === 'typed' ? 'Typed by the QS' : line.rate_note || 'No rate yet'}</p>}
      {parts.length > 0 && (
        <ul className="mt-2 border-t border-line pt-1.5">
          {parts.map((part) => <li key={part.code} className="flex gap-2 py-0.5"><span className="flex-1">{part.description}</span><span>{part.qty == null ? '' : num(part.qty)} {part.unit}</span></li>)}
        </ul>
      )}
      {ws.editor && line.source !== 'group' && <button className="mt-1.5 text-danger" onClick={() => { void ws.edit({ op: 'remove_line', code: line.code }); ws.setLine(null); }}>Remove from the BOQ</button>}
    </section>
  );
}
