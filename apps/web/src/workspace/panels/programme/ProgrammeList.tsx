/** The Programme (README §7.5): the contractor's activities under their headings with dates and the critical path;
 * the dock under the model with the 4D player and the Gantt chart; the readout over the model. */
import { CalendarDays, Maximize2, Upload } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { day as dayName } from '@/lib/format';
import { useWs } from '../../state';
import { Gantt } from './Gantt';
import { range } from './utils';
import { Opened } from './Opened';
import { upload } from './upload';
import { Reading } from './Reading';
import { useDrop } from './useDrop';
import { UploadCard } from './UploadCard';

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
