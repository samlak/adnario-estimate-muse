import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, Circle, Minimize2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { addDays } from '@/lib/calendar';
import { SPEEDS } from './constants';
import { PlayerButton } from './PlayerButton';
import type { usePlayer } from './usePlayer';

/** The 4D player's bar: start, back, play, forward, end, the day slider, speed, today; and outside full view,
 * recording, how not-started work shows, roof off and showing the activities. */
export function PlayerControls({ player, day, setDay, date, full, recording, onRecord, outline, setOutline, roofOff, setRoofOff, shown, setShown, onBack }: {
  player: ReturnType<typeof usePlayer>; day: number; setDay: (day: number) => void; date: Date; full: boolean; recording: boolean; onRecord: () => void;
  outline: boolean; setOutline: (on: boolean) => void; roofOff: boolean; setRoofOff: (on: boolean) => void; shown: boolean; setShown: (on: boolean) => void; onBack: () => void;
}) {
  const { playing, setPlaying, speed, setSpeed, last, step, jump, today } = player;
  return (
    <div className="flex h-[42px] shrink-0 items-center gap-1.5 px-2.5 text-[12.5px]">
      <PlayerButton title="Start" onClick={() => setDay(0)}><SkipBack size={13} /></PlayerButton>
      <PlayerButton title="Back a month" onClick={() => jump(addDays(date, -30))}><ChevronsLeft size={14} /></PlayerButton>
      <PlayerButton title="Back a day" onClick={() => step(-1)}><ChevronLeft size={14} /></PlayerButton>
      <button title={playing ? 'Pause' : 'Play'} className="grid h-[25px] w-[25px] place-items-center rounded-md bg-primary text-white" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={13} /> : <Play size={13} />}</button>
      <PlayerButton title="Forward a day" onClick={() => step(1)}><ChevronRight size={14} /></PlayerButton>
      <PlayerButton title="Forward a week" onClick={() => jump(addDays(date, 7))}><ChevronsRight size={14} /></PlayerButton>
      <PlayerButton title="End" onClick={() => setDay(last)}><SkipForward size={13} /></PlayerButton>
      <input type="range" aria-label="Day" min={0} max={last} value={day} onChange={(event) => setDay(Number(event.target.value))} className="mx-2 h-1.5 min-w-[120px] flex-1 accent-primary" />
      <select aria-label="Speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="h-[28px] rounded-md border border-line bg-white px-2">{SPEEDS.map((each) => <option key={each} value={each}>{each} days/s</option>)}</select>
      <button className="h-[28px] rounded-md border border-line px-2.5" onClick={today}>Today</button>
      {!full && (
        <>
          <button className="flex h-[28px] items-center gap-1.5 rounded-md border border-line px-2.5" onClick={onRecord}><Circle size={12} className={recording ? 'fill-danger text-danger' : ''} /> {recording ? 'Stop' : 'Record'}</button>
          <button className={`h-[28px] rounded-md border px-2.5 ${outline ? 'border-line' : 'border-primary-300 bg-primary-50'}`} onClick={() => setOutline(!outline)}>{outline ? 'Not started as outline' : 'Not started hidden'}</button>
          <button className={`h-[28px] rounded-md border px-2.5 ${roofOff ? 'border-primary-300 bg-primary-50' : 'border-line'}`} onClick={() => setRoofOff(!roofOff)}>Roof off</button>
          <button className="flex h-[28px] items-center gap-1 rounded-md border border-line px-2" onClick={() => setShown(!shown)}>{shown ? <ChevronDown size={13} /> : <ChevronUp size={13} />} {shown ? 'Hide activities' : 'Show activities'}</button>
        </>
      )}
      {full && <button className="flex h-[28px] items-center gap-1 rounded-md border border-line px-2" onClick={onBack}><Minimize2 size={13} /> Back to model</button>}
    </div>
  );
}
