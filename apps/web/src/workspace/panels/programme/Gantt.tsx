/** The programme's Gantt chart in the dock (README §7.5): activities under their headings, bars on the working
 * calendar by day, week or month, links between them and the critical path in red. */
import { useEffect, useMemo, useRef } from 'react';
import { addDays, parse } from '@/lib/calendar';
import { day as dayName } from '@/lib/format';
import { iso, useWs, type Activity } from '../../state';
import { LEFT, PX, ROW } from './constants';
import { ticksOf } from './ganttTicks';

export function Gantt({ zoom, table }: { zoom: keyof typeof PX; table: boolean }) {
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

  const ticks = ticksOf(ORIGIN, total, px, zoom);
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
