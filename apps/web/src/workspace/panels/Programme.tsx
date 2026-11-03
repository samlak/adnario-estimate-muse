/** The Programme (README §7.5): the contractor's activities under their headings with dates and the critical path;
 * the dock under the model with the 4D player and the Gantt chart; the readout over the model. */
import {
  CalendarDays, ChevronDown, ChevronLeft, CircleCheck, Loader2, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, Circle, Maximize2,
  Minimize2, Pause, Play, SkipBack, SkipForward, Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, parse, workingDays } from '@/lib/calendar';
import { day as dayName, naira } from '@/lib/format';
import { iso, useWs, weekOf, type Activity, type Plan, type Work } from '../state';
import { SCurve } from './CashFlow';

const ROW = 23;

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

const range = (activity: Activity) => (activity.summary ? '' : `${dayName(parse(activity.startDate))} – ${dayName(parse(activity.finishDate))}`);

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

/** Over the model: the player's day, what is done and what is under way. */
export function Readout() {
  const ws = useWs();
  const plan = ws.plan!;
  const date = plan.days[ws.day];
  const work = workDone(plan, ws.day);
  const now = underWay(plan, iso(date));
  return (
    <div className="absolute right-2.5 top-2.5 w-[208px] rounded-xl bg-white px-3 py-2.5 text-[11px] shadow-card">
      <b className="block text-[15px]">{dayName(date, true)}</b>
      <p className="text-[#6b7581]">Week {weekOf(plan, ws.day)} · Day {ws.day + 1} of {plan.days.length}</p>
      {ws.money && (
        <div className="mt-2 border-t border-line pt-2">
          <b className="block text-[13px]">{naira(work.done)}</b>
          <p className="font-medium text-primary">{work.done ? `+${naira(work.today)} today` : 'work done to date'}</p>
        </div>
      )}
      <ul className="mt-2 space-y-0.5">
        {now.slice(0, 3).map((activity) => <li key={activity.id} className="truncate"><b>{activity.id}</b> {activity.name}</li>)}
      </ul>
      {now.length > 3 && <p className="text-[#6b7581]">and {now.length - 3} more</p>}
    </div>
  );
}

const SPEEDS = [1, 2, 5, 10, 20];

/** The readout as the recording shows it: the card over the model, top right, with every activity under way. */
function drawReadout(pen: CanvasRenderingContext2D, width: number, unit: number, plan: Plan, at: number, money: boolean, project: string) {
  const date = plan.days[at];
  const work = workDone(plan, at);
  const now = underWay(plan, iso(date));
  const shown = now.slice(0, 8);
  const w = 330 * unit, pad = 16 * unit, x = width - w - 18 * unit, y = 18 * unit;
  const line = (text: string, size: number, color: string, weight = 400) => { pen.font = `${weight} ${size * unit}px Archivo, Arial, sans-serif`; pen.fillStyle = color; return text; };
  const fit = (text: string, room: number) => { let out = text; while (out.length > 4 && pen.measureText(out).width > room) out = `${out.slice(0, -2)}…`; return out; };
  const h = pad * 2 + 62 * unit + (money ? 52 * unit : 0) + 20 * unit * (shown.length || 1) + (now.length > 8 ? 20 * unit : 0) + 10 * unit;
  pen.save();
  pen.shadowColor = 'rgba(16,24,40,0.16)';
  pen.shadowBlur = 18 * unit;
  pen.shadowOffsetY = 4 * unit;
  pen.fillStyle = '#ffffff';
  pen.beginPath();
  pen.roundRect(x, y, w, h, 12 * unit);
  pen.fill();
  pen.restore();
  let at_y = y + pad + 20 * unit;
  pen.fillText(line(dayName(date, true), 21, '#12212f', 700), x + pad, at_y);
  at_y += 22 * unit;
  pen.fillText(line(`Week ${weekOf(plan, at)} · Day ${at + 1} of ${plan.days.length}`, 13, '#6b7581'), x + pad, at_y);
  at_y += 20 * unit;
  pen.fillText(fit(line(project, 12, '#9aa1a9'), w - pad * 2), x + pad, at_y);
  if (money) {
    at_y += 30 * unit;
    pen.fillText(line(naira(work.done), 18, '#12212f', 700), x + pad, at_y);
    at_y += 19 * unit;
    pen.fillText(line(work.done ? `+${naira(work.today)} today · work done to date` : 'work done to date', 12.5, '#1f3a5f', 600), x + pad, at_y);
  }
  at_y += 12 * unit;
  pen.fillStyle = '#e6e4dd';
  pen.fillRect(x + pad, at_y, w - pad * 2, 1 * unit);
  at_y += 6 * unit;
  if (!shown.length) { at_y += 18 * unit; pen.fillText(line('Nothing under way', 13, '#6b7581'), x + pad, at_y); }
  for (const activity of shown) {
    at_y += 20 * unit;
    pen.fillStyle = '#e0a93a';
    pen.fillRect(x + pad, at_y - 9 * unit, 7 * unit, 7 * unit);
    const label = line(`${activity.id}  ${activity.name}`, 13, '#12212f');
    pen.fillText(fit(label, w - pad * 2 - 14 * unit), x + pad + 14 * unit, at_y);
  }
  if (now.length > 8) { at_y += 20 * unit; pen.fillText(line(`and ${now.length - 8} more under way`, 12.5, '#6b7581'), x + pad, at_y); }
}

/** The dock: the 4D player, and the Gantt chart under it. In full view it is the whole workspace. */
export function Dock({ outline, setOutline, roofOff, setRoofOff, canvas, fit }: { outline: boolean; setOutline: (on: boolean) => void; roofOff: boolean; setRoofOff: (on: boolean) => void; canvas: () => HTMLCanvasElement | null; fit: () => void }) {
  const ws = useWs();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [shown, setShown] = useState(true);
  const [zoom, setZoom] = useState<'Days' | 'Weeks' | 'Months'>('Weeks');
  const [view, setView] = useState<'Gantt' | 'Table' | 'Cost curve'>('Gantt');
  const [recording, setRecording] = useState<MediaRecorder | null>(null);
  const plan = ws.plan!;
  const DAYS = plan.days;
  const last = DAYS.length - 1;
  const day = useRef(ws.day);
  day.current = ws.day;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (day.current >= last) return setPlaying(false);
      ws.setDay(day.current + 1);
    }, 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, speed]);
  useEffect(() => { if (!playing && recording) recording.stop(); }, [playing]);

  const step = (by: number) => ws.setDay(Math.min(last, Math.max(0, ws.day + by)));
  const jump = (date: Date) => ws.setDay(Math.max(0, Math.min(last, DAYS.findIndex((each) => each >= date))));
  const today = () => { const now = new Date(); jump(now < DAYS[0] ? DAYS[0] : now > DAYS[last] ? DAYS[last] : now); };
  const record = () => {
    const source = canvas();
    if (!source) return;
    if (recording) return setPlaying(false);
    // the model playing the programme, zoomed to fill the frame, with the whole readout drawn on it
    fit();
    const frame = document.createElement('canvas');
    frame.width = source.width;
    frame.height = source.height;
    const pen = frame.getContext('2d')!;
    let drawing = true;
    const draw = () => {
      if (!drawing) return;
      const unit = frame.height / 900; // sizes as on a 900px-high screen
      pen.fillStyle = '#f4f4f2';
      pen.fillRect(0, 0, frame.width, frame.height);
      pen.drawImage(source, 0, 0);
      drawReadout(pen, frame.width, unit, plan, day.current, ws.money, ws.projectName);
      // how far through the programme
      pen.fillStyle = '#e1e4e8';
      pen.fillRect(0, frame.height - 6 * unit, frame.width, 6 * unit);
      pen.fillStyle = '#1f3a5f';
      pen.fillRect(0, frame.height - 6 * unit, (frame.width * (day.current + 1)) / DAYS.length, 6 * unit);
      requestAnimationFrame(draw);
    };
    draw();
    const recorder = new MediaRecorder(frame.captureStream(30), { mimeType: 'video/webm' });
    const parts: Blob[] = [];
    recorder.ondataavailable = (event) => parts.push(event.data);
    recorder.onstop = () => {
      drawing = false;
      setRecording(null);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob(parts, { type: 'video/webm' }));
      link.download = `${ws.projectName} 4D.webm`;
      link.click();
    };
    recorder.start();
    setRecording(recorder);
    setPlaying(true);
  };

  const date = DAYS[ws.day];
  const work = workDone(plan, ws.day);
  const now = underWay(plan, iso(date));
  const controls = (
    <div className="flex h-[42px] shrink-0 items-center gap-1.5 px-2.5 text-[12.5px]">
      <PlayerButton title="Start" onClick={() => ws.setDay(0)}><SkipBack size={13} /></PlayerButton>
      <PlayerButton title="Back a month" onClick={() => jump(addDays(date, -30))}><ChevronsLeft size={14} /></PlayerButton>
      <PlayerButton title="Back a day" onClick={() => step(-1)}><ChevronLeft size={14} /></PlayerButton>
      <button title={playing ? 'Pause' : 'Play'} className="grid h-[25px] w-[25px] place-items-center rounded-md bg-primary text-white" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={13} /> : <Play size={13} />}</button>
      <PlayerButton title="Forward a day" onClick={() => step(1)}><ChevronRight size={14} /></PlayerButton>
      <PlayerButton title="Forward a week" onClick={() => jump(addDays(date, 7))}><ChevronsRight size={14} /></PlayerButton>
      <PlayerButton title="End" onClick={() => ws.setDay(last)}><SkipForward size={13} /></PlayerButton>
      <input type="range" min={0} max={last} value={ws.day} onChange={(event) => ws.setDay(Number(event.target.value))} className="mx-2 h-1.5 min-w-[120px] flex-1 accent-primary" />
      <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="h-[28px] rounded-md border border-line bg-white px-2">{SPEEDS.map((each) => <option key={each} value={each}>{each} days/s</option>)}</select>
      <button className="h-[28px] rounded-md border border-line px-2.5" onClick={today}>Today</button>
      {!ws.full && (
        <>
          <button className="flex h-[28px] items-center gap-1.5 rounded-md border border-line px-2.5" onClick={record}><Circle size={12} className={recording ? 'fill-danger text-danger' : ''} /> {recording ? 'Stop' : 'Record'}</button>
          <button className={`h-[28px] rounded-md border px-2.5 ${outline ? 'border-line' : 'border-primary-300 bg-primary-50'}`} onClick={() => setOutline(!outline)}>{outline ? 'Not started as outline' : 'Not started hidden'}</button>
          <button className={`h-[28px] rounded-md border px-2.5 ${roofOff ? 'border-primary-300 bg-primary-50' : 'border-line'}`} onClick={() => setRoofOff(!roofOff)}>Roof off</button>
          <button className="flex h-[28px] items-center gap-1 rounded-md border border-line px-2" onClick={() => setShown(!shown)}>{shown ? <ChevronDown size={13} /> : <ChevronUp size={13} />} {shown ? 'Hide activities' : 'Show activities'}</button>
        </>
      )}
      {ws.full && <button className="flex h-[28px] items-center gap-1 rounded-md border border-line px-2" onClick={() => ws.setFull(false)}><Minimize2 size={13} /> Back to model</button>}
    </div>
  );
  return (
    <div className={`flex flex-col border-t border-line bg-white ${ws.full ? 'h-full border-t-0' : shown ? 'h-[54%]' : ''}`}>
      {controls}
      {ws.full && (
        <p className="flex gap-3 px-3 pb-1.5 text-[12px] text-[#59636e]">
          <b className="text-ink">{dayName(date, true)}</b> Day {ws.day + 1} of {DAYS.length}
          <span className="flex-1 truncate">Under way: {now.length ? `${now.slice(0, 1).map((each) => each.name).join(', ')}${now.length > 1 ? ` and ${now.length - 1} more` : ''}` : 'nothing'}</span>
          {ws.money && <span>Work done {naira(work.done)} · this month {naira(work.month)}</span>}
        </p>
      )}
      {(shown || ws.full) && (
        <>
          <div className="flex items-center px-2.5 pb-1.5">
            <div className="flex rounded-lg bg-canvas p-0.5 text-[12px]">
              {(['Days', 'Weeks', 'Months'] as const).map((each) => <button key={each} onClick={() => setZoom(each)} className={`rounded-md px-2.5 py-1 ${zoom === each ? 'bg-white font-semibold shadow-sm' : 'text-[#59636e]'}`}>{each}</button>)}
            </div>
            <span className="flex-1" />
            {ws.full && (
              <div className="flex rounded-lg bg-canvas p-0.5 text-[12px]">
                {(['Gantt', 'Table', 'Cost curve'] as const).filter((each) => ws.money || each !== 'Cost curve').map((each) => <button key={each} onClick={() => setView(each)} className={`rounded-md px-2.5 py-1 ${view === each ? 'bg-white font-semibold shadow-sm' : 'text-[#59636e]'}`}>{each}</button>)}
              </div>
            )}
          </div>
          {view === 'Cost curve' && ws.full ? <div className="p-4"><SCurve width={980} height={300} /></div> : <Gantt zoom={zoom} table={view === 'Table' && ws.full} />}
        </>
      )}
      {!ws.full && !shown && null}
    </div>
  );
}

const PlayerButton = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
  <button title={title} onClick={onClick} className="grid h-[25px] w-[25px] place-items-center rounded-md border border-line text-[#3b4652]">{children}</button>
);

const PX = { Days: 24, Weeks: 8.6, Months: 2.6 };
const LEFT = 310;
function Gantt({ zoom, table }: { zoom: keyof typeof PX; table: boolean }) {
  const ws = useWs();
  const plan = ws.plan!;
  const DAYS = plan.days;
  const ORIGIN = addDays(plan.start, -2);
  const END = addDays(plan.finish, 10);
  const offset = (date: Date | string) => Math.round(((typeof date === 'string' ? parse(date) : date).getTime() - ORIGIN.getTime()) / 86400000);
  const box = useRef<HTMLDivElement>(null);
  const px = PX[zoom];
  const total = offset(END);
  const width = total * px;
  const today = iso(DAYS[ws.day]);
  const rows = plan.activities;
  const rowOf = useMemo(() => new Map(rows.map((activity, index) => [activity.id, index])), [rows]);
  // keep the player's day in view
  useEffect(() => {
    const scroller = box.current;
    if (!scroller) return;
    const x = LEFT + offset(today) * px;
    if (x < scroller.scrollLeft + LEFT + 40 || x > scroller.scrollLeft + scroller.clientWidth - 60) scroller.scrollLeft = x - LEFT - scroller.clientWidth / 3;
    // and the work under way on it, once the player is past the first weeks
    const first = rows.findIndex((activity) => !activity.summary && activity.startDate <= today && today <= activity.finishDate && activity.level > 1);
    if (first > 0 && ws.activity == null) {
      const y = first * ROW;
      if (y < scroller.scrollTop || y > scroller.scrollTop + scroller.clientHeight - 80) scroller.scrollTop = y - 60;
    }
  }, [today, px]);
  useEffect(() => {
    if (ws.activity == null || !box.current) return;
    box.current.scrollTop = (rowOf.get(ws.activity) ?? 0) * ROW - 60;
  }, [ws.activity]);

  const ticks: { x: number; label: string; month?: string }[] = [];
  for (let d = 0; d <= total; d++) {
    const date = addDays(ORIGIN, d);
    const month = date.getDate() === 1 ? date.toLocaleString('en-US', { month: 'short', year: 'numeric' }) : undefined;
    if (zoom === 'Days') ticks.push({ x: d * px, label: String(date.getDate()), month });
    else if (zoom === 'Weeks' && (date.getDay() === 1 || month)) ticks.push({ x: d * px, label: date.getDay() === 1 ? String(date.getDate()) : '', month });
    else if (zoom === 'Months' && month) ticks.push({ x: d * px, label: '', month });
  }
  const bar = (activity: Activity, index: number) => {
    const y = index * ROW;
    const x0 = offset(activity.startDate) * px;
    const x1 = (offset(activity.finishDate) + 1) * px;
    if (activity.summary) return <rect key={activity.id} x={x0} y={y + 9} width={x1 - x0} height={5} fill="#4b5560" />;
    if (activity.milestone) return <path key={activity.id} d={`M${x0} ${y + 4}l7 7.5-7 7.5-7-7.5z`} fill="#3f8f63" stroke="#2e6b4a" />;
    const done = activity.finishDate < today, started = activity.startDate <= today;
    const cut = started && !done ? (offset(today) + 1) * px : x0;
    const light = activity.critical ? { fill: '#f6d9d5', stroke: '#e3a89f' } : { fill: '#d8e8f3', stroke: '#9fc1de' };
    return (
      <g key={activity.id}>
        {done ? <rect x={x0} y={y + 5} width={x1 - x0} height={13} rx={3} fill="#3f8f63" /> : (
          <>
            <rect x={x0} y={y + 5} width={x1 - x0} height={13} rx={3} fill={light.fill} stroke={light.stroke} />
            {started && <rect x={x0} y={y + 5} width={cut - x0} height={13} rx={3} fill={activity.critical ? '#b3402f' : '#3f8f63'} />}
          </>
        )}
      </g>
    );
  };
  const arrows = rows.flatMap((activity, index) =>
    activity.follows.filter((id) => rowOf.has(id)).map((id) => {
      const from = rows[rowOf.get(id)!];
      const fx = (offset(from.finishDate) + 1) * px, fy = rowOf.get(id)! * ROW + 11.5;
      const tx = offset(activity.startDate) * px, ty = index * ROW + 11.5;
      const color = activity.critical && from.critical ? '#b3402f' : '#9aa1a9';
      return (
        <g key={`${id}-${activity.id}`} stroke={color} fill="none" strokeWidth={1.2}>
          <path d={`M${fx} ${fy}h5V${ty}H${tx - 1}`} />
          <path d={`M${tx - 5} ${ty - 3}l4 3-4 3`} fill={color} />
        </g>
      );
    }),
  );
  return (
    <div ref={box} className="thin-scroll relative min-h-0 flex-1 overflow-auto text-[11.5px]">
      <div style={{ width: table ? '100%' : LEFT + width }} className="relative">
        {/* header */}
        <div className="sticky top-0 z-20 flex h-[38px] border-b border-line bg-white">
          <div className={`sticky left-0 z-10 grid shrink-0 grid-cols-[1fr_34px_46px_50px] items-end gap-1 bg-white px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6b7581] ${table ? 'w-full max-w-[760px]' : ''}`} style={table ? undefined : { width: LEFT }}>
            <span>Activity</span><span className="text-right">Days</span><span>Start</span><span>Finish</span>
          </div>
          {!table && (
            <div className="relative" style={{ width }}>
              {ticks.map((tick, index) => (
                <span key={index}>
                  {tick.month && <span className="absolute top-1 whitespace-nowrap text-[11px] font-semibold text-[#3b4652]" style={{ left: tick.x + 2 }}>{tick.month}</span>}
                  {tick.label && <span className="absolute bottom-1.5 text-[10.5px] text-[#6b7581]" style={{ left: tick.x - 3 }}>{tick.label}</span>}
                </span>
              ))}
              <span className="absolute bottom-0.5 rounded bg-accent px-1 text-[10px] font-bold text-ink" style={{ left: offset(today) * px - 14 }}>{dayName(DAYS[ws.day])}</span>
            </div>
          )}
        </div>
        <div className="relative flex">
          <div className={`sticky left-0 z-10 shrink-0 bg-white ${table ? 'w-full max-w-[760px]' : ''}`} style={table ? undefined : { width: LEFT }}>
            {rows.map((activity) => (
              <button
                key={activity.id}
                onClick={() => !activity.summary && ws.setActivity(activity.id)}
                className={`grid w-full grid-cols-[1fr_34px_46px_50px] items-center gap-1 px-2.5 text-left ${ws.activity === activity.id ? 'bg-primary-50' : ''}`}
                style={{ height: ROW }}
              >
                <span className={`truncate ${activity.summary ? 'font-bold' : ''}`} style={{ paddingLeft: activity.level * 9 }} title={activity.name}>{activity.id} {activity.name}</span>
                <span className="text-right">{activity.days}</span>
                <span>{dayName(parse(activity.startDate))}</span>
                <span>{dayName(parse(activity.finishDate))}</span>
              </button>
            ))}
          </div>
          {!table && (
            <svg width={width} height={rows.length * ROW} className="shrink-0">
              {ticks.filter((tick) => tick.label || tick.month).map((tick, index) => <line key={index} x1={tick.x} x2={tick.x} y1={0} y2={rows.length * ROW} stroke="#eeede8" />)}
              {rows.map((activity, index) => ws.activity === activity.id && <rect key={activity.id} x={0} y={index * ROW} width={width} height={ROW} fill="#eef5fa" />)}
              {arrows}
              {rows.map(bar)}
              <line x1={offset(today) * px + px / 2} x2={offset(today) * px + px / 2} y1={0} y2={rows.length * ROW} stroke="#e8b13c" strokeWidth={2} />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

