/** The dock under the model (README §7.5): the 4D player that builds the model day by day, the Gantt, and the
 * readout drawn over the model with the day, the week, what is under way and the value of work done. */
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, Circle, Minimize2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addDays } from '@/lib/calendar';
import { day as dayName, naira } from '@/lib/format';
import { iso, useWs, weekOf, type Plan, type Work } from '../state';
import { SCurve } from './CashFlow';
import { workDone, underWay, range } from './Programme';
import { Gantt } from './Gantt';

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
