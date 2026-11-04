/** The Programme (README §7.5): the contractor's activities under their headings with dates and the critical path;
 * the dock under the model with the 4D player and the Gantt chart; the readout over the model. */
import { CalendarDays, CircleCheck, Loader2, Maximize2, Play, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parse } from '@/lib/calendar';
import { day as dayName, naira } from '@/lib/format';
import { useWs, type Activity, type Plan, type Work } from '../state';
import { Gantt } from './Gantt';

/** The value of the work done by the start of a day, and on it: each activity's priced work spread evenly over its
 * working days (as the cash flow does). */
export function workDone(plan: Plan, day: number) {
  let done = 0, today = 0, month = 0;
  const key = plan.dayIso[day].slice(0, 7);
  const first = plan.dayIso.findIndex((each) => each.startsWith(key));
  for (const activity of plan.leaves) {
    const length = activity.finish - activity.start;
    if (!activity.cost || !length) continue;
    const perDay = activity.cost / length;
    const gone = (at: number) => Math.max(0, Math.min(at, activity.finish) - activity.start);
    done += perDay * gone(day);
    month += perDay * (gone(day) - gone(first));
    if (activity.start <= day && day < activity.finish) today += perDay;
  }
  return { done: Math.round(done), today: Math.round(today), month: Math.round(month) };
}

export const underWay = (plan: Plan, date: string) => plan.leaves.filter((activity) => activity.startDate <= date && date <= activity.finishDate);

export const range = (activity: Activity) => (activity.summary ? '' : `${dayName(parse(activity.startDate))} – ${dayName(parse(activity.finishDate))}`);

export function ProgrammeList() {
  const ws = useWs();
  const rows = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ws.activity) rows.current?.querySelector(`[data-id="${ws.activity}"]`)?.scrollIntoView({ block: 'center' });
  }, [ws.activity]);
  const plan = ws.plan;
  const drop = useDrop();
  if (!plan) return <UploadCard />;
  const opened = plan.byId.get(ws.activity ?? -1);
  const programme = ws.estimate!.programme!;
  return (
    <div className={`min-h-full px-[15px] pt-[15px] text-[12px] ${drop.over ? 'bg-primary-50/60' : ''}`} {...drop.handlers}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-primary"><CalendarDays size={13} /> PROGRAMME</p>
      <h2 className="mt-1.5 text-[15px] font-bold">{plan.days.length} working days</h2>
      {drop.refused && <p className="mt-1 text-danger">{drop.refused}</p>}
      <p className="text-[11.5px] text-[#59636e]">{dayName(plan.start, true)} → {dayName(plan.finish, true)}</p>
      <div className="mt-2 flex gap-1.5">
        <button className="btn-ghost h-[28px] rounded-md px-2.5 text-[12px] font-medium" onClick={() => ws.setFull(true)}><Maximize2 size={13} /> Full view: Gantt and table</button>
        {ws.editor && (
          <label className="btn-ghost h-[28px] cursor-pointer rounded-md px-2.5 text-[12px] font-medium">
            <Upload size={13} /> Upload a new programme
            <input type="file" accept="application/pdf" hidden onChange={(event) => upload(ws.start, event.target.files)} />
          </label>
        )}
      </div>
      {ws.work?.kind === 'programme' && <div className="mt-2"><Reading work={ws.work} /></div>}
      {programme.not_in_programme.length > 0 && (
        <details className="mt-2 rounded-lg bg-accent-50/60 px-2.5 py-1.5 text-[11.5px]">
          <summary className="cursor-pointer font-semibold">{programme.not_in_programme.length} pieces of measured work are in no activity</summary>
          <ul className="mt-1 space-y-0.5 text-[#59636e]">{programme.not_in_programme.map((each, index) => <li key={index}>{each.section}, {each.storey}: {each.operation}</li>)}</ul>
        </details>
      )}
      {opened && <Opened activity={opened} />}
      <div ref={rows} className="mt-2.5 pb-24">
        {plan.activities.map((activity) => (
          <button
            key={activity.id}
            data-id={activity.id}
            onClick={() => {
              if (activity.summary) return;
              ws.setActivity(ws.activity === activity.id ? null : activity.id);
              if (ws.activity !== activity.id && activity.refs.length) ws.show(activity.refs);
            }}
            className={`grid w-full grid-cols-[34px_1fr_auto_34px] items-center gap-1 border-b border-line py-[5px] text-left ${ws.activity === activity.id ? 'bg-primary-50' : ''} ${activity.summary ? 'cursor-default' : 'hover:bg-paper'}`}
          >
            <span className="pl-0.5 font-mono text-[11.5px]">{activity.id}</span>
            <span className={activity.summary ? 'text-[11.5px] font-bold tracking-[0.04em]' : 'text-[11.5px]'} style={{ paddingLeft: Math.max(0, activity.level - 1) * 10 + (activity.summary ? 0 : 10) }}>{activity.name}</span>
            <span className="whitespace-nowrap pl-2 text-[11px] text-[#59636e]">{range(activity)}</span>
            <span className={`text-right text-[11.5px] ${activity.critical ? 'text-danger' : ''}`}>{activity.summary ? '' : `${activity.days} d`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Opened({ activity }: { activity: Activity }) {
  const ws = useWs();
  const plan = ws.plan!;
  const follows = activity.follows.map((id) => plan.byId.get(id)).filter(Boolean) as Activity[];
  const leads = plan.leaves.filter((each) => each.follows.includes(activity.id));
  return (
    <section className="mt-3 rounded-xl border border-primary-200 bg-primary-50/40 px-3 py-2.5">
      <b className="text-[12.5px]">{activity.id} {activity.name}</b>
      <p className="mt-0.5 text-[#59636e]">{range(activity)} · {activity.days} working days{activity.critical ? ' · critical' : ''}</p>
      {follows.length > 0 && <p className="mt-1">Follows: {follows.map((each) => `${each.id} ${each.name}`).join('; ')}</p>}
      {leads.length > 0 && <p className="mt-1">Leads to: {leads.map((each) => `${each.id} ${each.name}`).join('; ')}</p>}
      {ws.money && activity.work.length > 0 && (
        <ul className="mt-1.5 border-t border-line pt-1">
          {activity.work.map((work, index) => <li key={index} className="flex gap-2 py-0.5"><span className="w-9 text-[#6b7581]">{ws.result?.refs[work.code]}</span><span className="flex-1">{work.description}</span><span>{work.qty == null ? '' : work.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })} {work.unit}</span></li>)}
          <li className="pt-1 font-semibold">{naira(activity.cost ?? 0)}</li>
        </ul>
      )}
      <div className="mt-1.5 flex gap-3">
        <button className="font-semibold text-primary" onClick={() => ws.setDay(activity.start)}>Play from its start</button>
        {activity.refs.length > 0 && <button className="font-semibold text-primary" onClick={() => ws.show(activity.refs)}>Show its {activity.refs.length} elements</button>}
      </div>
    </section>
  );
}

function upload(start: (kind: 'programme', body?: FormData) => void, files: FileList | null) {
  const file = files?.[0];
  if (!file) return;
  const body = new FormData();
  body.append('file', file);
  start('programme', body);
}

/** The programme being read: the file, then its two steps. */
function Reading({ work }: { work: Work }) {
  const step = (name: string) => work.stages.find((stage) => stage.name === name)?.state;
  return (
    <section className="rounded-xl border border-line px-3.5 py-3 text-[13px]">
      <b className="block truncate text-[13.5px]">{work.file ?? 'Your programme'}</b>
      <ul className="mt-2 space-y-1.5">
        {([['Read', 'Read your programme'], ['Link', 'Put the BOQ work under its activities']] as const).map(([name, label]) => {
          const state = step(name) ?? (name === 'Read' && !work.done ? 'start' : undefined);
          return (
            <li key={name} className={`flex items-center gap-2 ${state === 'done' ? 'text-[#59636e]' : state ? 'font-semibold' : 'text-[#9aa1a9]'}`}>
              {state === 'done' ? <CircleCheck size={14} className="text-success" /> : state && !work.done ? <Loader2 size={14} className="animate-spin text-primary" /> : <span className="h-3.5 w-3.5 rounded-full border border-[#c3c7cb]" />} {label}
            </li>
          );
        })}
      </ul>
      {work.error && <p className="mt-2 text-danger">{work.error}</p>}
    </section>
  );
}

/** The programme's PDF dropped anywhere on the panel (the browser would otherwise open it). */
function useDrop() {
  const ws = useWs();
  const [over, setOver] = useState(false);
  const [refused, setRefused] = useState('');
  const ready = !!ws.result?.boq?.length;
  const busy = ws.work?.kind === 'programme' && !ws.work.done;
  const can = ws.editor && ready && !busy;
  const why = !ws.editor ? 'Only a QS or Admin who can edit this project uploads the programme.' : !ready ? 'Generate the BOQ in Takeoff first: the programme waits for it.' : busy ? 'The programme is still being read.' : '';
  const handlers = {
    onDragOver: (event: React.DragEvent) => { event.preventDefault(); setOver(true); },
    onDragLeave: (event: React.DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(false); },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setOver(false);
      const file = event.dataTransfer.files[0];
      if (!file) return;
      if (!/\.pdf$/i.test(file.name)) setRefused('The programme must be a PDF.');
      else if (!can) setRefused(why);
      else { setRefused(''); upload(ws.start, event.dataTransfer.files); }
    },
  };
  return { over, refused, can, ready, handlers };
}

function UploadCard() {
  const ws = useWs();
  const { over, refused, can, ready, handlers } = useDrop();
  return (
    <div className="h-full px-[15px] pt-[15px] text-[13px]" {...handlers}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-primary"><CalendarDays size={13} /> PROGRAMME</p>
      <h2 className="mt-1.5 text-[15.5px] font-bold">No programme yet</h2>
      <p className="mt-1 leading-[1.55] text-[#59636e]">Upload the contractor's programme of works as a PDF. Its activities, durations and links are kept as written; the AI puts the BOQ's measured work under each activity (code checks it), so each shows its BOQ lines, cost and elements in the 4D.</p>
      <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed px-3 py-3 ${over ? 'border-primary bg-primary-50' : 'border-[#c9ced4]'}`}>
        <label className={`btn-primary h-[34px] whitespace-nowrap rounded-lg px-3 ${can ? 'cursor-pointer' : 'pointer-events-none opacity-60'}`}>
          <Upload size={15} /> Upload your programme (PDF)
          <input type="file" accept="application/pdf" hidden onChange={(event) => upload(ws.start, event.target.files)} />
        </label>
        <span className="text-[#59636e]">or drop the PDF here</span>
      </div>
      {refused ? <p className="mt-2 text-[12.5px] text-danger">{refused}</p> : !ready && <p className="mt-2 text-[12px] text-[#6b7581]">It waits for a generated BOQ: generate it in Takeoff first.</p>}
      {ws.work?.kind === 'programme' && <div className="mt-3"><Reading work={ws.work} /></div>}
    </div>
  );
}

