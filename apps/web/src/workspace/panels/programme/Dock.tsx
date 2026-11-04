/** The dock under the model (README §7.5): the 4D player that builds the model day by day, and the Gantt under it.
 * In full view it is the whole workspace. */
import { useEffect, useState } from 'react';
import { iso, useWs } from '../../state';
import { SCurve } from '../cash-flow/SCurve';
import { VIEWS, ZOOMS } from './constants';
import { DayLine } from './DayLine';
import { Gantt } from './Gantt';
import { PlayerControls } from './PlayerControls';
import { record4d } from './record4d';
import { Segmented } from './Segmented';
import { usePlayer } from './usePlayer';
import { underWay, workDone } from './utils';

export function Dock({ outline, setOutline, roofOff, setRoofOff, canvas, fit }: { outline: boolean; setOutline: (on: boolean) => void; roofOff: boolean; setRoofOff: (on: boolean) => void; canvas: () => HTMLCanvasElement | null; fit: () => void }) {
  const ws = useWs();
  const plan = ws.plan!;
  const player = usePlayer(plan.days, ws.day, ws.setDay);
  const [shown, setShown] = useState(true);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>('Weeks');
  const [view, setView] = useState<(typeof VIEWS)[number]>('Gantt');
  const [recording, setRecording] = useState<MediaRecorder | null>(null);
  useEffect(() => { if (!player.playing && recording) recording.stop(); }, [player.playing]);

  const record = () => {
    const source = canvas();
    if (!source) return;
    if (recording) return player.setPlaying(false);
    fit(); // the model zoomed to fill the frame
    setRecording(record4d(source, plan, () => player.current.current, ws.money, ws.projectName, () => setRecording(null)));
    player.setPlaying(true);
  };

  const date = plan.days[ws.day];
  return (
    <div className={`flex flex-col border-t border-line bg-white ${ws.full ? 'h-full border-t-0' : shown ? 'h-[54%]' : ''}`}>
      <PlayerControls
        player={player} day={ws.day} setDay={ws.setDay} date={date} full={ws.full} recording={!!recording} onRecord={record}
        outline={outline} setOutline={setOutline} roofOff={roofOff} setRoofOff={setRoofOff} shown={shown} setShown={setShown} onBack={() => ws.setFull(false)}
      />
      {ws.full && <DayLine date={date} day={ws.day} days={plan.days.length} underWay={underWay(plan, iso(date))} money={ws.money} work={workDone(plan, ws.day)} />}
      {(shown || ws.full) && (
        <>
          <div className="flex items-center px-2.5 pb-1.5">
            <Segmented options={ZOOMS} value={zoom} onChange={setZoom} />
            <span className="flex-1" />
            {ws.full && <Segmented options={VIEWS.filter((each) => ws.money || each !== 'Cost curve')} value={view} onChange={setView} />}
          </div>
          {view === 'Cost curve' && ws.full ? <div className="p-4"><SCurve width={980} height={300} /></div> : <Gantt zoom={zoom} table={view === 'Table' && ws.full} />}
        </>
      )}
    </div>
  );
}
