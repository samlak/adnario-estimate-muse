/** The Takeoff panel (README §7.2–7.3): the start card or the run's card, then Takeoff, BOQ, Review, Provisional and
 * Types. Full view shows the bills as a document: Summary, A Preliminaries, then each bill. */
import { CircleCheck, FileSpreadsheet, FileText, ListChecks, Maximize2, Minimize2, Redo2, RefreshCw, Undo2 } from 'lucide-react';
import { useWs } from '../../state';
import { Generate } from './Generate';
import { BoqLines } from './BoqLines';
import { Bills } from './Bills';
import { Legend } from './Legend';
import { RunCard } from './RunCard';
import { StartCard } from './StartCard';
import { minutes } from './minutes';
import { Icon } from './Icon';
import { Measured } from './Measured';
import { Review } from './Review';
import { Provisional } from './Provisional';
import { Types } from './Types';

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
