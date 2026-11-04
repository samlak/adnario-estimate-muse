import { parse } from '@/lib/calendar';
import { monthName, short } from '@/lib/format';
import { useWs } from '../../state';

/** Months as bars, the cumulative value as a line: solid to the player's day, dashed after. */
export function SCurve({ width, height }: { width: number; height: number }) {
  const ws = useWs();
  const plan = ws.plan!;
  const months = plan.months;
  const max = months[months.length - 1]?.cumulative || 1;
  const left = 58, bottom = 22, top = 8;
  const step = (width - left - 10) / months.length;
  const y = (value: number) => top + (height - top - bottom) * (1 - value / max);
  // where the player's day falls: a fraction of its month, by working days
  const today = plan.dayIso[ws.day];
  const key = today.slice(0, 7);
  const at = Math.max(0, months.findIndex((month) => month.month === key));
  const inMonth = plan.dayIso.filter((each) => each.startsWith(key));
  const fraction = inMonth.length ? inMonth.filter((each) => each <= today).length / inMonth.length : 0;
  const before = at ? months[at - 1].cumulative : 0;
  const nowX = left + (at + fraction) * step;
  const nowY = y(before + months[at].total * fraction);
  const points = [[left, y(0)], ...months.map((month, index) => [left + (index + 1) * step, y(month.cumulative)])];
  const solid = [...points.slice(0, at + 1), [nowX, nowY]];
  const dashed = [[nowX, nowY], ...points.slice(at + 1)];
  const path = (list: number[][]) => list.map(([px, py], index) => `${index ? 'L' : 'M'}${px} ${py}`).join('');
  return (
    <svg width={width} height={height} className="block max-w-full text-[10.5px]" viewBox={`0 0 ${width} ${height}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((part) => (
        <g key={part}>
          <line x1={left} x2={width - 8} y1={y(max * part)} y2={y(max * part)} stroke="#e6e4dd" />
          <text x={left - 6} y={y(max * part) + 3.5} textAnchor="end" fill="#59636e">{short(max * part)}</text>
        </g>
      ))}
      {months.map((month, index) => (
        <g key={month.month}>
          <rect x={left + index * step + step * 0.2} y={y(month.total)} width={step * 0.6} height={y(0) - y(month.total)} fill="#c9d6e5" />
          <text x={left + index * step + step / 2} y={height - 6} textAnchor="middle" fill="#59636e">{monthName(parse(`${month.month}-01`), false)}</text>
        </g>
      ))}
      <line x1={nowX} x2={nowX} y1={top} y2={y(0)} stroke="#e8b13c" strokeWidth={1.5} />
      <path d={path(solid)} fill="none" stroke="#1d3f66" strokeWidth={2} />
      <path d={path(dashed)} fill="none" stroke="#7d8ea1" strokeWidth={2} strokeDasharray="4 4" />
      <circle cx={nowX} cy={nowY} r={3.5} fill="#1d3f66" />
    </svg>
  );
}
