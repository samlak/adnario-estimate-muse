/** The Takeoff panel before and during the run (README §7.2): the start card, then the run's live card with its
 * stages, the types as the AI maps them and the confidence legend. */
import { Bot, ChevronDown, ChevronRight, ChevronUp, CircleCheck, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Conf } from '@/components/ui/Conf';
import { num } from '@/lib/format';
import { useWs, type Card, type Work } from '../../state';
import { HEX } from '../../viewer/constants';
import { minutes } from './minutes';
import { Legend } from './Legend';
import { RUN_STEPS, WEIGHT } from './runSteps';

/** A run as it goes: where it is, what it found, what the AI makes of the model, and each type as it is decided
 * (the newest numbered on the model). */
export function RunCard({ work }: { work: Work }) {
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
