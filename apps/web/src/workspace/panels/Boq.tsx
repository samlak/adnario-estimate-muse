/** The BOQ in the Takeoff panel (README §7.3): Generate BOQ, its items with quantities and rates the QS can change,
 * a line added by hand, and the bills as a document in full view. */
import { ListChecks, Loader2, Plus, X } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { Conf } from '@/components/ui';
import { errorText } from '@/lib/api';
import { naira, num } from '@/lib/format';
import { useWs, type Item, type Result } from '../state';
import { HEX } from '../Viewer';
import { Head, Section, bySection } from './table';

export function Generate() {
  const ws = useWs();
  const working = ws.work?.kind === 'boq' ? ws.work : null;
  const busy = !!ws.work && !ws.work.done;
  return (
    <section className="px-2.5 pt-4 text-[13px]">
      <h3 className="text-[17px]">{working && !working.done ? 'Generating the BOQ…' : 'No BOQ yet'}</h3>
      <p className="mt-2 leading-[1.6] text-[#6b7581]">The takeoff is measured. Generate the BOQ to group it into a contractor's bill: the AI groups lines that are the same work and words them in the firm's style; code checks every line is used once and adds up the quantities.</p>
      {working && !working.done ? (
        <p className="mt-4 flex items-center gap-2"><Loader2 size={14} className="animate-spin text-primary" /> {(working.feed[0] as { text?: string } | undefined)?.text ?? 'Grouping the takeoff into BOQ items, element by element'}</p>
      ) : (
        <button className="btn-primary mt-4 h-[34px] rounded-lg px-3.5" disabled={!ws.editor || busy} onClick={() => ws.start('boq')}><ListChecks size={15} /> Generate BOQ</button>
      )}
      {working?.error && <p className="mt-2 text-danger">{working.error}</p>}
    </section>
  );
}

export function BoqLines({ result }: { result: Result }) {
  const ws = useWs();
  const opened = result.boq.find((line) => line.code === ws.line);
  return (
    <>
      {opened && <Inspector line={opened} result={result} />}
      <table className="w-full text-[12px]">
        <Head cols={[['Item'], ['Description'], ['Qty', 'right'], ['Unit'], ws.money ? ['Rate', 'right'] : ['Confidence']]} />
        <tbody>
          {bySection(result.boq).map(([section, lines]) => (
            <Fragment key={section}>
              <Section name={section} span={5} />
              {lines.map((line) => (
                <tr key={line.code} className={`cursor-pointer border-b border-line align-top hover:bg-paper ${ws.line === line.code ? 'bg-primary-50' : ''}`} onClick={() => { ws.setLine(ws.line === line.code ? null : line.code); ws.show(line.gids); }}>
                  <td className="whitespace-nowrap py-1.5 pl-1.5 text-[#6b7581]"><i aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: HEX[line.confidence] }} title={`${line.confidence} confidence`} />{result.refs[line.code]}</td>
                  <td className="py-1.5 pr-2">{line.description}{line.source === 'provisional' && <small className="text-accent-600"> · provisional</small>}</td>
                  <td className="py-1 text-right"><Edit line={line} field="qty" /></td>
                  <td className="py-1.5 pl-2">{line.unit}</td>
                  <td className="py-1 pl-1 text-right">{ws.money ? <Edit line={line} field="rate" /> : <Conf value={line.confidence} />}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      {ws.editor && <AddLine />}
    </>
  );
}

/** A quantity or rate typed in the table itself: saved on Enter or leaving the cell, one step of undo. A measured
 * quantity that was changed shows the measured one beside it. */
function Edit({ line, field }: { line: Item; field: 'qty' | 'rate' }) {
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

/** A BOQ item opened: its rate and where it came from, the measured lines in it, its elements in 3D. */
function Inspector({ line, result }: { line: Item; result: Result }) {
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

const SECTIONS = ['Substructure', 'Frame', 'Upper floors', 'Stairs', 'Walls', 'Roof', 'Windows', 'Doors', 'Wall finishes', 'Floor finishes', 'Ceiling finishes', 'Fittings and furnishings',
  'Sanitary installations', 'Plumbing and drainage', 'Mechanical installations', 'Electrical installations', 'Lift installations', 'Fire protection', 'External works', 'Drainage', 'Fencing and gates'];
const UNITS = ['m', 'm²', 'm³', 'nr', 't', 'kg', 'item'];

function AddLine() {
  const ws = useWs();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ section: 'Substructure', description: '', qty: '', unit: 'm²', rate: '' });
  const [error, setError] = useState('');
  if (!open) return <button className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-primary" onClick={() => setOpen(true)}><Plus size={13} /> Add a line</button>;
  return (
    <form className="mt-2 space-y-1.5 rounded-xl border border-line p-2.5 text-[12px]" onSubmit={(event) => {
      event.preventDefault();
      ws.edit({ op: 'add_line', section: form.section, description: form.description, unit: form.unit, qty: Number(form.qty || 0), rate: form.rate === '' ? null : Number(form.rate) })
        .then(() => { setOpen(false); setForm({ ...form, description: '', qty: '', rate: '' }); })
        .catch((error) => setError(errorText(error)));
    }}>
      <select className="h-7 w-full rounded border border-line" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })}>{SECTIONS.map((each) => <option key={each}>{each}</option>)}</select>
      <input className="h-7 w-full rounded border border-line px-1.5" placeholder="Description" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      <div className="flex gap-1.5">
        <input className="h-7 w-20 rounded border border-line px-1.5" placeholder="Qty" type="number" min={0} step="any" value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} />
        <select className="h-7 rounded border border-line" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{UNITS.map((each) => <option key={each}>{each}</option>)}</select>
        <input className="h-7 w-24 rounded border border-line px-1.5" placeholder="Rate ₦" type="number" min={0} value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} />
        <span className="flex-1" />
        <button type="button" className="text-[#59636e]" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn-primary h-7 px-2.5 text-[12px]">Add</button>
      </div>
      {error && <p className="text-danger">{error}</p>}
    </form>
  );
}

/** The bills as a document: the summary, A Preliminaries, then each bill. */
export function Bills({ result }: { result: Result }) {
  const ws = useWs();
  const totals = result.totals;
  const [bill, setBill] = useState('summary');
  if (!totals) return null;
  const bills = Object.entries(totals.bills);
  const pricing = result.pricing;
  const tabs = [['summary', 'Summary'], ['A', 'A · Preliminaries'], ...bills.map(([letter, each]) => [letter, `${letter} · ${each.name}`])];
  const shown = bills.find(([letter]) => letter === bill);
  const amount = (line: Item) => (line.rate == null || line.qty == null ? null : line.rate * line.qty);
  return (
    <>
      <div className="flex gap-1 border-b border-line text-[13px]">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setBill(id)} className={`rounded-t-lg border px-3.5 py-2 ${bill === id ? '-mb-px border-line border-b-white bg-white font-semibold' : 'border-transparent text-[#59636e]'}`}>{label}</button>
        ))}
      </div>
      <table className="mt-3.5 w-full overflow-hidden rounded-xl text-[13px]">
        <Head cols={bill === 'summary' || bill === 'A' ? [['Bill'], ['Description'], ['Amount', 'right']] : [['Item'], ['Description'], ['Qty', 'right'], ['Unit'], ['Rate', 'right'], ['Amount', 'right']]} />
        <tbody>
          {bill === 'summary' && (
            <>
              <BillRow letter="A" name="Preliminaries" amount={totals.prelims} />
              {bills.map(([letter, each]) => (
                <Fragment key={letter}>
                  <BillRow letter={letter} name={each.name} amount={each.total} />
                  {Object.entries(each.sections).map(([name, value], index) => (
                    <tr key={name} className="border-b border-line"><td /><td className="py-2.5"><span className="inline-block w-6 text-[#9aa1a9]">{index + 1}</span>{name}</td><td className="py-2.5 pr-4 text-right">{naira(value)}</td></tr>
                  ))}
                </Fragment>
              ))}
              <tr className="border-b border-line"><td /><td className="py-2.5">Contingency {pricing.contingency}%</td><td className="py-2.5 pr-4 text-right">{naira(totals.contingency)}</td></tr>
              <tr className="border-b border-line"><td /><td className="py-2.5">VAT {pricing.vat}%</td><td className="py-2.5 pr-4 text-right">{naira(totals.vat)}</td></tr>
              <tr className="bg-[#f4f3ef] font-bold"><td /><td className="py-3">Total</td><td className="py-3 pr-4 text-right">{naira(totals.total)}</td></tr>
              {totals.unpriced > 0 && <tr><td /><td colSpan={2} className="py-2 text-[12px] text-[#6b7581]">{totals.unpriced} items have no rate and are not in the totals.</td></tr>}
            </>
          )}
          {bill === 'A' && <tr className="border-b border-line"><td className="px-3 py-2.5">A</td><td className="py-2.5">Preliminaries, {pricing.prelims}% of the measured work ({naira(totals.measured)})</td><td className="py-2.5 pr-4 text-right">{naira(totals.prelims)}</td></tr>}
          {shown && Object.entries(shown[1].sections).map(([name, value], index) => (
            <Fragment key={name}>
              <tr className="border-b border-line bg-[#f7f9fb] font-semibold"><td className="px-3 py-2.5">{shown[0]}{index + 1}</td><td className="py-2.5" colSpan={4}>{name}</td><td className="py-2.5 pr-4 text-right">{naira(value)}</td></tr>
              {result.boq.filter((line) => line.bill === shown[0] && line.section === name).map((line) => (
                <tr key={line.code} className="cursor-pointer border-b border-line align-top hover:bg-paper" title="Show it on the model" onClick={() => { ws.setLine(line.code); ws.show(line.gids); }}>
                  <td className="px-3 py-2 text-[#6b7581]">{result.refs[line.code]}</td>
                  <td className="py-2 pr-3">{line.description}</td>
                  <td className="py-1.5 text-right"><Edit line={line} field="qty" /></td>
                  <td className="py-2 pl-2">{line.unit}</td>
                  <td className="py-1.5 text-right"><Edit line={line} field="rate" /></td>
                  <td className="py-2 pr-4 text-right">{amount(line) == null ? '' : naira(amount(line)!)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </>
  );
}

const BillRow = ({ letter, name, amount }: { letter: string; name: string; amount: number }) => (
  <tr className="border-b border-line bg-[#f7f9fb] font-bold"><td className="px-3.5 py-3">{letter}</td><td className="py-3">{name}</td><td className="py-3 pr-4 text-right">{naira(amount)}</td></tr>
);
