/** The Takeoff panel (README §7.2–7.3): the start card or the run's card, then Takeoff, BOQ, Review, Provisional and
 * Types. Full view shows the bills as a document: Summary, A Preliminaries, then each bill. */
import { CircleCheck, FileSpreadsheet, FileText, ListChecks, Maximize2, Minimize2, Redo2, RefreshCw, Undo2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Conf } from '@/components/ui';
import { num } from '@/lib/format';
import { useWs, type Item, type Result } from '../state';
import { Head, Section, bySection } from './table';
import { Generate, BoqLines, Bills } from './Boq';
import { Legend, RunCard, StartCard, minutes } from './TakeoffRun';

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
