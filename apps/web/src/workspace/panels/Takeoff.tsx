/** The Takeoff panel (README §7.2–7.3): the start card or the run's card, then Takeoff, BOQ, Review, Provisional and
 * Types. Full view shows the bills as a document: Summary, A Preliminaries, then each bill. */
import { Bot, ChevronDown, ChevronRight, ChevronUp, CircleCheck, FileSpreadsheet, FileText, ListChecks, Loader2, Maximize2, MessageSquareText, Minimize2, Paperclip, Play, Plus, Redo2, RefreshCw, ShieldCheck, Undo2, X } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { Conf } from '@/components/ui';
import { errorText } from '@/lib/api';
import { naira, num } from '@/lib/format';
import { send } from '@/lib/store';
import { useWs, type Card, type Item, type Result, type Work } from '../state';
import { HEX } from '../Viewer';

const LEGEND = [['High', '#2e9d5b'], ['Medium', '#e0a93a'], ['Low', '#e0712f'], ['Excluded', '#b9bec4'], ['Not mapped', '#c0392b']];
const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

export function Takeoff() {
  const ws = useWs();
  const result = ws.result;
  if (ws.work?.kind === 'run' && (!ws.work.done || ws.work.error)) return <RunCard work={ws.work} />;
  if (!result) return <StartCard />;
  const boq = result.boq ?? [];
  const notMeasured = result.types.filter((type) => type.mapping.decision !== 'bill' || type.mapping.held);
  const tabs: [string, string, number][] = [
    ['takeoff', 'Takeoff', result.takeoff_lines.length], ['boq', 'BOQ', boq.length],
    ['review', 'Review', result.questions.length + notMeasured.length], ['provisional', 'Provisional', result.provisional.length], ['types', 'Types', result.types.length],
  ];
  const estimate = ws.estimate!;
  const busy = !!ws.work && !ws.work.done;
  return (
    <div className={ws.full ? 'px-[26px] pt-[17px]' : 'px-[15px] pt-[15px]'}>
      <section className="rounded-2xl border border-line px-[13px] py-[14px]">
        <p className="flex items-center gap-2 text-[11.5px] font-bold tracking-[0.12em] text-success"><CircleCheck size={14} /> {estimate.name.toUpperCase()} · READY IN {minutes(result.run.seconds)}</p>
        <p className={`mt-2.5 text-[13px] leading-[1.5] ${ws.full ? '' : 'line-clamp-3'}`} title={result.brief}>{result.brief}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {boq.length === 0 && (
            <button className="btn-primary h-[29px] whitespace-nowrap rounded-lg px-2.5 text-[12.5px]" disabled={!ws.editor || busy} onClick={() => { ws.setBoqTab('boq'); ws.start('boq'); }}><ListChecks size={14} /> Generate BOQ</button>
          )}
          {boq.length > 0 && (
            <>
              <a className="btn-primary h-[29px] whitespace-nowrap rounded-lg px-2.5 text-[12.5px]" href={`/api/v1/estimates/${estimate.id}/export/boq.xlsx`}><FileSpreadsheet size={14} /> Excel</a>
              <a className="btn-ghost h-[29px] whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium" href={`/api/v1/estimates/${estimate.id}/export/boq.pdf`}><FileText size={14} /> PDF</a>
              {ws.editor && <button className="btn-ghost h-[29px] whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium" disabled={busy} title="Group the takeoff into BOQ items again; rates you have stay" onClick={() => { ws.setBoqTab('boq'); ws.start('boq'); }}><ListChecks size={14} /> Generate again</button>}
            </>
          )}
          <button className={`btn-ghost h-[29px] whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium ${ws.full ? 'border-primary' : ''}`} onClick={() => ws.setFull(!ws.full)}>
            {ws.full ? <><Minimize2 size={14} /> Back to model</> : <><Maximize2 size={14} /> Full view</>}
          </button>
          <span className="flex-1" />
          <Icon title="Undo" disabled={!ws.undo} onClick={ws.undo}><Undo2 size={14} /></Icon>
          <Icon title="Redo" disabled={!ws.redo} onClick={ws.redo}><Redo2 size={14} /></Icon>
          <Icon title="Update estimate: measure the current models again, keeping your work" disabled={!ws.editor || busy} onClick={() => ws.start('run')}><RefreshCw size={14} /></Icon>
        </div>
        <div className="mt-2.5"><Legend /></div>
        {result.review_summary && <p className="mt-2 text-[12px] leading-[1.5] text-[#59636e]">{result.review_summary}</p>}
        <details className="mt-2 text-[12px]">
          <summary className="cursor-pointer text-primary">What does confidence mean?</summary>
          <p className="mt-1.5 text-[#59636e]">Code works it out from checks anyone can repeat, never a number the AI states: a door billed in Walls, a type name that says nothing (“Type 1”), a material the description contradicts, the AI saying it is guessing. A Low mapping is held for the QS instead of billed.</p>
        </details>
        <details className="mt-2 text-[12px]">
          <summary className="cursor-pointer text-primary">Project information used</summary>
          <p className="mt-1.5 whitespace-pre-wrap text-[#59636e]">{result.context || 'No documents were given with this run; the brief is from the models alone.'}</p>
        </details>
      </section>
      <div className={`mt-4 grid grid-cols-5 border-b border-line ${ws.full ? '' : '-mx-[15px]'}`}>
        {tabs.map(([id, label, count]) => (
          <button key={id} onClick={() => ws.setBoqTab(id)} className={`-mb-px h-[38px] border-b-2 text-[12.5px] ${ws.boqTab === id ? 'border-primary-600 font-semibold' : 'border-transparent text-[#59636e]'}`}>
            {label} <small className="text-[9.5px] text-[#9aa1a9]">{count}</small>
          </button>
        ))}
      </div>
      <div className="pb-24 pt-2.5">
        {ws.boqTab === 'takeoff' && <Measured result={result} />}
        {ws.boqTab === 'boq' && (boq.length === 0 || (ws.work?.kind === 'boq' && !ws.work.done) ? <Generate /> : ws.full ? <Bills result={result} /> : <BoqLines result={result} />)}
        {ws.boqTab === 'review' && <Review result={result} />}
        {ws.boqTab === 'provisional' && <Provisional result={result} />}
        {ws.boqTab === 'types' && <Types result={result} />}
      </div>
    </div>
  );
}

const Icon = ({ title, disabled, onClick, children }: { title: string; disabled?: boolean; onClick?: (() => void) | null; children: React.ReactNode }) => (
  <button title={title} disabled={disabled} onClick={onClick ?? undefined} className="grid h-[29px] w-[29px] place-items-center rounded-lg border border-line text-[#3b4652] disabled:text-[#c3c7cb]">{children}</button>
);

const Head = ({ cols }: { cols: [string, string?][] }) => (
  <thead className="bg-[#f4f3ef]"><tr>{cols.map(([name, align = 'left']) => <th key={name} className="th py-2 text-[10.5px]" style={{ textAlign: align as 'left' }}>{name}</th>)}</tr></thead>
);
const Section = ({ name, span }: { name: string; span: number }) => (
  <tr className="border-b border-line bg-[#f7f9fb]"><td colSpan={span} className="px-1.5 py-2 text-[12.5px] font-bold">{name}</td></tr>
);

/** Lines grouped under their sections, in the order they come (Nigerian elemental order). */
function bySection<T extends { section: string }>(lines: T[]): [string, T[]][] {
  const out: [string, T[]][] = [];
  for (const line of lines) {
    const last = out[out.length - 1];
    if (last?.[0] === line.section) last[1].push(line);
    else out.push([line.section, [line]]);
  }
  return out;
}

function Measured({ result }: { result: Result }) {
  const ws = useWs();
  const [tab, setTab] = useState<'measured' | 'not'>('measured');
  const not = result.types.filter((type) => type.mapping.decision !== 'bill' || type.mapping.held);
  return (
    <>
      <div className="flex border-b border-line text-[12.5px]">
        <button onClick={() => setTab('measured')} className={`rounded-t-lg border px-3.5 py-1.5 ${tab === 'measured' ? '-mb-px border-line border-b-white bg-white font-semibold' : 'border-transparent text-[#59636e]'}`}>Measured <small className="text-[#9aa1a9]">{result.takeoff_lines.length}</small></button>
        <button onClick={() => setTab('not')} className={`rounded-t-lg border px-3.5 py-1.5 ${tab === 'not' ? '-mb-px border-line border-b-white bg-white font-semibold' : 'border-transparent text-[#59636e]'}`}>Not measured <small className="text-[#9aa1a9]">{not.length}</small></button>
      </div>
      {tab === 'measured' ? (
        <table className="mt-3 w-full text-[12.5px]">
          <Head cols={[['Item'], ['Qty', 'right'], ['Unit'], ['Confidence']]} />
          <tbody>
            {bySection(result.takeoff_lines).map(([section, lines]) => (
              <Fragment key={section}>
                <Section name={section} span={4} />
                {lines.map((line) => (
                  <tr key={line.code} className={`cursor-pointer border-b border-line align-top hover:bg-paper ${ws.line === line.code ? 'bg-primary-50' : ''}`} onClick={() => { ws.setLine(ws.line === line.code ? null : line.code); ws.show(line.gids); }}>
                    <td className="py-2 pl-1.5 pr-2">{line.description}{line.count > 0 && <small className="text-[11px] text-[#59636e]"> · {line.count} el.</small>}</td>
                    <td className="py-2 text-right">{line.qty == null ? '' : num(line.qty)}</td>
                    <td className="py-2 pl-2">{line.unit}</td>
                    <td className="py-2 pl-2"><Conf value={line.confidence} /></td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="mt-3 w-full text-[12.5px]">
          <Head cols={[['Type'], ['No.', 'right'], ['']]} />
          <tbody>
            {not.map((type) => (
              <tr key={type.key} className="cursor-pointer border-b border-line align-top hover:bg-paper" onClick={() => ws.show(type.gids)}>
                <td className="py-2 pl-1.5 pr-2">
                  <b className="font-semibold text-primary">{type.type}</b>
                  <p className="text-[11.5px] text-[#6b7581]">{type.mapping.held ? 'Held: ' : ''}{type.mapping.reason || 'not mapped'}</p>
                </td>
                <td className="py-2 text-right">{type.count}</td>
                <td className="py-2 pl-2 text-right">
                  <button className="btn-ghost h-[27px] whitespace-nowrap px-2.5 text-[12px]" disabled={!ws.editor} onClick={(event) => { event.stopPropagation(); void ws.edit({ op: 'type', code: type.key, decision: 'bill' }); }}>Add to takeoff</button>
                </td>
              </tr>
            ))}
          </tbody>
          {not.length === 0 && <caption className="caption-bottom py-6 text-[12.5px] text-[#6b7581]">Every type was measured.</caption>}
        </table>
      )}
    </>
  );
}

function Generate() {
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

function BoqLines({ result }: { result: Result }) {
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
function Bills({ result }: { result: Result }) {
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

function Review({ result }: { result: Result }) {
  const ws = useWs();
  const held = result.types.filter((type) => type.mapping.held);
  const left = result.types.filter((type) => !type.mapping.held && (type.mapping.decision === 'exclude' || type.mapping.decision === 'unmapped') && !/billed from/.test(type.mapping.reason));
  const TONE = { high: 'bg-danger-50 text-danger', medium: 'bg-accent-50 text-accent-600', low: 'bg-canvas text-[#59636e]' };
  return (
    <>
      {result.questions.length > 0 && (
        <section className="mb-3 rounded-2xl border border-line px-3 py-3">
          <h3 className="pb-1 text-[13px] font-bold">Questions for the QS</h3>
          {result.questions.map((question, index) => (
            <div key={index} className="border-b border-line py-2.5 text-[12.5px] last:border-0">
              <span className={`pill mr-1.5 ${TONE[question.severity]}`}>{question.severity}</span>{question.question}
              {question.line_codes.length > 0 && <p className="mt-1 text-[11.5px] text-[#6b7581]">About {question.line_codes.map((code) => result.takeoff_lines.find((line) => line.code === code)?.description ?? code).join('; ')}</p>}
            </div>
          ))}
        </section>
      )}
      {[['Held: the AI was unsure. Bill them?', held, 'Bill as suggested'], ['Left out of the BOQ: include them?', left, 'Bill it']].map(([title, types, yes]) => (types as typeof held).length > 0 && (
        <section key={title as string} className="mb-3 rounded-2xl border border-line px-3 py-3">
          <h3 className="pb-1 text-[13px] font-bold">{title as string}</h3>
          {(types as typeof held).map((type) => (
            <div key={type.key} className="border-b border-line py-2.5 last:border-0">
              <button className="text-left text-[12.5px] font-semibold hover:text-primary" onClick={() => ws.show(type.gids)}>{type.type}</button>
              <p className="text-[11.5px] leading-[1.45] text-[#6b7581]">{type.class.replace(/^Ifc/, '')} ×{type.count}{type.mapping.reason ? ` · ${type.mapping.reason}` : ''}</p>
              {type.mapping.items[0] && <p className="text-[11.5px] text-[#59636e]">{type.mapping.items[0].description}</p>}
              <div className="mt-2 flex gap-2 text-[12px]">
                <button disabled={!ws.editor || !type.mapping.items.length} onClick={() => void ws.edit({ op: 'type', code: type.key, decision: 'bill' })} className="rounded-md border border-line px-2.5 py-1 disabled:text-[#b5bbc1]">{yes as string}</button>
                <button disabled={!ws.editor} onClick={() => void ws.edit({ op: 'type', code: type.key, decision: 'exclude' })} className="rounded-md px-2.5 py-1 text-[#59636e]">Leave out</button>
              </div>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

function Provisional({ result }: { result: Result }) {
  const ws = useWs();
  const inBoq = new Set(result.boq.map((line) => line.code));
  return (
    <>
      <p className="mb-1.5 text-[12px] text-[#59636e]">Not in the model; proposed by the AI review, with quantities code works out from what each is based on. Add the ones you want to the BOQ.</p>
      <table className="w-full text-[12px]">
        <Head cols={[['Item'], ['Description'], ['Qty', 'right'], ['Unit'], ['']]} />
        <tbody>
          {result.provisional.map((item) => {
            const added = inBoq.has(item.code);
            return (
              <tr key={item.code} className="border-b border-line align-top">
                <td className="py-1.5 pl-1.5">{item.code}</td>
                <td className="py-1.5 pr-2">{item.description}<small className="block text-[11px] text-[#6b7581]">{item.reason}</small></td>
                <td className="py-1.5 text-right">{item.qty == null ? '' : num(item.qty)}</td>
                <td className="py-1.5 pl-2">{item.unit}</td>
                <td className="py-1 pl-2 text-right">
                  <button disabled={!ws.editor || !result.boq.length} title={result.boq.length ? '' : 'Generate the BOQ first'} className={`whitespace-nowrap rounded-md border px-2 py-1 ${added ? 'border-success-100 bg-success-50 text-success' : 'border-line'}`}
                    onClick={() => void ws.edit(added ? { op: 'remove_line', code: item.code } : { op: 'add_provisional', code: item.code })}>
                    {added ? 'Added' : 'Add to BOQ'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function Types({ result }: { result: Result }) {
  const ws = useWs();
  return (
    <table className="w-full text-[12.5px]">
      <Head cols={[['Key'], ['Type'], ['Nr', 'right'], ['Decision']]} />
      <tbody>
        {result.types.map((type) => (
          <tr key={type.key} className="cursor-pointer border-b border-line align-top hover:bg-paper" onClick={() => ws.show(type.gids)}>
            <td className="py-2 pl-1.5">{type.key}</td>
            <td className="py-2 pr-2">{type.class.replace(/^Ifc/, '')}<span className="block text-[#6b7581]">{[type.family ? `${type.family}:${type.type}` : type.type, type.size, type.model].filter(Boolean).join(' · ')}</span></td>
            <td className="py-2 pr-3 text-right">{type.count}</td>
            <td className="py-2">
              {type.mapping.decision === 'bill' ? type.mapping.items.map((item) => item.description).join('; ') : type.mapping.decision === 'exclude' ? 'Left out' : 'Not mapped'}
              {type.mapping.reason && <span className="block text-[#6b7581]">{type.mapping.reason}</span>}
              <span className="mt-1 inline-block">{type.mapping.decision === 'bill' ? <Conf value={type.mapping.confidence} /> : null}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const RUN_STEPS: [string, string][] = [
  ['Context', 'Read the project information'], ['Read', 'Read the model'], ['Catalogue', 'Group into types'], ['Understand', 'Understand the building'],
  ['Map', 'Map types to BOQ items'], ['Derive', 'Derive formwork and beds'], ['BOQ', 'Build the BOQ'], ['Review', 'Review the draft'],
];
const WEIGHT: Record<string, number> = { Context: 0.03, Read: 0.08, Catalogue: 0.02, Understand: 0.07, Map: 0.48, Derive: 0.03, BOQ: 0.02, Review: 0.27 };

const Legend = () => (
  <p className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-[#59636e]">
    {LEGEND.map(([name, color]) => <span key={name} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{name}</span>)}
  </p>
);

/** A run as it goes: where it is, what it found, what the AI makes of the model, and each type as it is decided
 * (the newest numbered on the model). */
function RunCard({ work }: { work: Work }) {
  const ws = useWs();
  const [, tick] = useState(0);
  const [seenOpen, setSeenOpen] = useState(true);
  useEffect(() => {
    if (work.done) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [work.done]);
  const stage = (name: string) => work.stages.find((each) => each.name === name);
  const hasContext = !!ws.estimate?.info.text || !!ws.estimate?.info.documents?.length;
  const steps = RUN_STEPS.filter(([name]) => name !== 'Context' || hasContext);
  const types = Number(stage('Catalogue')?.types ?? 0);
  const now = steps.find(([name]) => stage(name)?.state === 'start');
  const progress = steps.reduce((sum, [name]) => {
    const at = stage(name);
    if (at?.state === 'done') return sum + WEIGHT[name];
    if (at && name === 'Map' && types) return sum + WEIGHT[name] * Math.min(1, work.mapped / types);
    return sum;
  }, 0) / steps.reduce((sum, [name]) => sum + WEIGHT[name], 0);
  const elapsed = (Date.now() - work.started) / 1000;
  const names = ws.models.filter((model) => model.state === 'current').map((model) => model.name).join(' + ');
  const stats: [string, string][] = [
    [stage('Read')?.elements != null ? num(Number(stage('Read')!.elements)) : '–', 'elements'],
    [types ? String(types) : '–', 'types'], [String(work.mapped), 'mapped'], [stage('BOQ')?.lines != null ? String(stage('BOQ')!.lines) : '–', 'BOQ lines'],
  ];
  const numbered = work.feed.filter((each): each is Card => 'key' in each && each.confidence !== 'Excluded').slice(0, 8).map((card) => card.key);
  return (
    <div className="flex min-h-full flex-col px-[15px] pt-[15px]">
      <section className="rounded-2xl border border-line px-[15px] py-[14px]">
        <p className="flex items-center gap-2 text-[11.5px] font-bold tracking-[0.12em] text-primary"><i className="h-2 w-2 rounded-full bg-primary" /> {work.error ? 'STOPPED' : 'ESTIMATING'}</p>
        <h2 className="mt-1 text-[16px] font-bold leading-[1.3]">{names || ws.estimate?.name}</h2>
        <p className="mt-2.5 flex text-[13px] font-medium"><span className="flex-1">{work.error ? work.error : now ? `${now[1]}…` : 'Saving…'}</span><span className="text-[#59636e]">{minutes(elapsed)}</span></p>
        <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[#e9ecef]"><div className="h-full rounded-full bg-gradient-to-r from-primary to-[#5b8fc7] transition-all duration-700" style={{ width: `${Math.max(3, progress * 100)}%` }} /></div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {stats.map(([value, label]) => <div key={label} className="rounded-lg bg-[#f4f3ef] px-2.5 py-2"><b className="block text-[16px]">{value}</b><small className="text-[11.5px] text-[#59636e]">{label}</small></div>)}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
          {steps.map(([name, label]) => {
            const at = stage(name);
            const done = at?.state === 'done';
            return (
              <li key={name} className={`flex items-center gap-2 ${done ? 'text-[#3b4652]' : at ? 'font-semibold' : 'text-[#9aa1a9]'}`}>
                {done ? <CircleCheck size={14} className="shrink-0 text-success" /> : at && !work.done ? <Loader2 size={14} className="shrink-0 animate-spin text-primary" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#c3c7cb]" />}
                <span className="flex-1 leading-[1.35]">{label}</span>
                {done && <small className="text-[11.5px] text-[#6b7581]">{minutes(Number(at.seconds ?? 0))}</small>}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="mt-3 rounded-xl border border-[#e4dcf7] bg-[#f8f5fe] px-3 py-2.5 text-[12.5px]">
        <button className="flex w-full items-center gap-2 text-left font-semibold text-[#5b3fc4]" onClick={() => setSeenOpen(!seenOpen)}><Bot size={15} /> What the AI sees in this model <span className="flex-1" />{seenOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
        {seenOpen && (work.seen ? (
          <ul className="thin-scroll mt-1.5 max-h-[220px] list-disc space-y-1 overflow-y-auto pl-5 leading-[1.5] text-[#2b3440]">
            {work.seen.split('\n').map((row) => row.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean).map((row, at) => <li key={at}>{row}</li>)}
          </ul>
        ) : <p className="mt-1.5 text-[#59636e]">{stage('Understand') ? 'Reading the model…' : 'Waiting for the model to be read…'}</p>)}
      </section>
      <div className="mt-4 flex items-center">
        <p className="flex-1 text-[11px] font-semibold tracking-[0.1em] text-[#59636e]">LIVE ACTIVITY</p>
        <label className="flex items-center gap-1.5 text-[12.5px] text-[#3b4652]"><input type="checkbox" checked={ws.labels} onChange={(event) => ws.setLabels(event.target.checked)} /> Label the model</label>
      </div>
      <ul className="mt-2 flex-1 space-y-1.5 pb-3">
        {work.feed.map((each, at) => 'key' in each ? (
          <li key={`${each.key}-${at}`}>
            <button className="flex w-full gap-2 rounded-lg border border-line border-l-[3px] bg-white px-2.5 py-2 text-left hover:bg-paper" style={{ borderLeftColor: HEX[each.confidence] }} onClick={() => ws.show(each.gids)}>
              <span className="min-w-0 flex-1">
                <b className="block text-[12.5px] font-semibold leading-[1.4]">{numbered.includes(each.key) && ws.labels && <i className="mr-1 not-italic text-[#6b7581]">{numbered.indexOf(each.key) + 1}.</i>}{each.title}</b>
                <small className="block text-[11.5px] leading-[1.45] text-[#6b7581]">{each.detail}</small>
              </span>
              <span className="shrink-0 text-right">
                {each.qty && <b className="block text-[12px] font-semibold">{each.qty}</b>}
                <Conf value={each.confidence as never} />
              </span>
            </button>
          </li>
        ) : (
          <li key={at} className="flex gap-2 py-0.5 text-[12.5px] leading-[1.45] text-[#3b4652]"><ChevronRight size={14} className="mt-0.5 shrink-0 text-[#9aa1a9]" />{each.text}</li>
        ))}
      </ul>
      <div className="sticky bottom-0 -mx-[15px] border-t border-line bg-white px-[15px] py-2.5"><Legend /></div>
    </div>
  );
}

/** Before a run: what it will do, project information for the AI (optional), then Start takeoff. */
function StartCard() {
  const ws = useWs();
  const estimate = ws.estimate;
  const [text, setText] = useState(estimate?.info.text ?? '');
  const [sharing, setSharing] = useState(true);
  const [error, setError] = useState('');
  const busy = !!ws.work && !ws.work.done;
  const current = ws.models.filter((model) => model.state === 'current');
  const ready = current.some((model) => model.status === 'ready');
  if (!estimate) return null;
  const upload = (files: FileList | null) => {
    const body = new FormData();
    [...(files ?? [])].slice(0, 10).forEach((file) => body.append('files', file));
    send(`/estimates/${estimate.id}/documents`, 'POST', body, `/projects/${ws.projectId}/estimate`).catch((failure) => setError(errorText(failure)));
  };
  const given = !!text.trim() || !!estimate.info.documents?.length;
  return (
    <div className="p-[15px]">
      <section className="rounded-2xl border border-line px-[18px] py-[16px]">
        <p className="text-[11.5px] font-bold tracking-[0.12em] text-primary">READY FOR TAKEOFF</p>
        <h2 className="mt-1 text-[16.5px] font-bold">{current.length > 1 ? `${current.length} models` : current[0]?.name ?? 'No model yet'}</h2>
        {current.length > 1 && <p className="mt-1 text-[12.5px] text-[#59636e]">{current.map((model) => model.name).join(' · ')}. One BOQ for all of them; elements modelled in two disciplines are billed once.</p>}
        <ol className="mt-3 space-y-2.5 text-[13px]">
          {RUN_STEPS.filter(([name]) => name !== 'Context').map(([name, label], at) => (
            <li key={name} className="flex items-center gap-3"><span className="grid h-[19px] w-[19px] place-items-center rounded-full bg-[#eef1f4] text-[10.5px] font-semibold text-[#3b4652]">{at + 1}</span>{label}</li>
          ))}
        </ol>
        <div className="mt-4 border-t border-line pt-3">
          <button className="flex w-full items-center gap-2 text-left text-[13px] font-semibold text-primary" onClick={() => setSharing(!sharing)}>
            <MessageSquareText size={15} /> Share something about this project? <small className="font-normal text-[#9aa1a9]">optional</small>
            {given && <i className="h-1.5 w-1.5 rounded-full bg-success" />}
            <span className="flex-1" />{sharing ? <ChevronUp size={15} className="text-[#6b7581]" /> : <ChevronDown size={15} className="text-[#6b7581]" />}
          </button>
          {sharing && (
            <div className="mt-2.5 rounded-xl border border-line px-3 pb-2 pt-2 focus-within:border-primary-300">
              <textarea className="h-[78px] w-full resize-y bg-transparent text-[13px] leading-[1.5] outline-none placeholder:text-[#9aa1a9]" placeholder="Location, use, specification… e.g. 2-storey office in Lekki, Lagos. C25 concrete, 225mm sandcrete walls."
                value={text} disabled={!ws.editor} onChange={(event) => setText(event.target.value)} onBlur={() => text !== (estimate.info.text ?? '') && void send(`/estimates/${estimate.id}/info`, 'PATCH', { text })} />
              <div className="flex items-center gap-2.5">
                <label className={`flex h-[30px] items-center gap-1.5 rounded-full border border-line px-3 text-[12.5px] ${ws.editor ? 'cursor-pointer hover:border-primary-300' : 'opacity-60'}`}>
                  <Paperclip size={13} /> Attach
                  <input type="file" multiple hidden accept=".pdf,.docx,.txt,.md" disabled={!ws.editor} onChange={(event) => upload(event.target.files)} />
                </label>
                <small className="text-[12px] text-[#9aa1a9]">PDF, Word or text</small>
              </div>
            </div>
          )}
          {(estimate.info.documents ?? []).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">{(estimate.info.documents ?? []).map((name) => <li key={name} className="flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[12px] text-primary"><FileText size={12} /> {name}</li>)}</ul>
          )}
        </div>
        {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
        <button className="btn-primary mt-4 h-[42px] w-full rounded-lg text-[14px]" disabled={!ws.editor || busy || !ready} onClick={async () => {
          if (text !== (estimate.info.text ?? '')) await send(`/estimates/${estimate.id}/info`, 'PATCH', { text });
          ws.start('run');
        }}><Play size={15} /> {busy ? 'Running…' : 'Start takeoff'}</button>
        {!ready && <p className="mt-2 text-[12px] text-[#6b7581]">{ws.models.length ? 'Waiting for the models to convert…' : 'Upload the building models first: Import IFC, top left.'}</p>}
        {!ws.editor && <p className="mt-2 text-[12px] text-[#6b7581]">Only a QS or Admin who can edit this project starts the takeoff.</p>}
        <p className="mt-3 flex gap-2 text-[12px] leading-[1.5] text-[#59636e]"><ShieldCheck size={14} className="mt-0.5 shrink-0" /><span>Only a summary of element <i>types</i> goes to the AI, never the model file. Rates are left blank for you to price.</span></p>
      </section>
    </div>
  );
}
