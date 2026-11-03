/** The Cash flow (README §7.6): the money spread over the programme, month by month, as an S-curve of the
 * cumulative value and a table; a month opens to the activities that worked in it. */
import { Box, CalendarDays, ChevronDown, ChevronRight, Download, LineChart, Maximize2 } from 'lucide-react';
import { Empty } from '@/components/ui';
import { Fragment, useState } from 'react';
import { parse } from '@/lib/calendar';
import { day as dayName, monthName, naira, short } from '@/lib/format';
import { useWs } from '../state';

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

export function CashFlow() {
  const ws = useWs();
  const [open, setOpen] = useState<string[]>([]);
  const plan = ws.plan;
  if (!ws.result?.boq.length) return <Empty icon={Box} title="No BOQ yet">The cash flow spreads the priced BOQ over the programme. Start a takeoff and generate the BOQ first.</Empty>;
  if (!plan || !plan.months.length) return <Empty icon={CalendarDays} title="No programme yet">The cash flow follows the programme of works: upload it in Programme and the priced work is spread month by month.</Empty>;
  const months = plan.months;
  const total = months[months.length - 1].cumulative;
  const unpriced = ws.estimate?.programme?.unpriced ?? [];
  const cols = ws.full ? ['Work', 'Prelims', 'Contingency', 'VAT', 'Month total', 'To date'] : ['Work', 'Month total', 'To date'];
  const cell = (month: (typeof months)[number], col: string) =>
    ({ Work: month.work, Prelims: month.prelims, Contingency: month.contingency, VAT: month.vat, 'Month total': month.total, 'To date': month.cumulative })[col]!;
  return (
    <div className={ws.full ? 'px-[26px] pt-[17px]' : 'px-[15px] pt-[17px]'}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-primary"><LineChart size={13} /> CASH FLOW</p>
      <h2 className="mt-1.5 text-[16.5px] font-bold">{naira(total)}</h2>
      <p className="mt-2.5 text-[12.5px] leading-[1.5] text-[#59636e]">Value of the work done, with preliminaries, contingency and VAT, by month to completion on {dayName(plan.finish, true)}.</p>
      {unpriced.length > 0 && <p className="mt-1 text-[12px] text-accent-600">{unpriced.length} BOQ lines are left out for want of a rate.</p>}
      <div className="mt-3 flex gap-1.5">
        {!ws.full && <button className="btn-ghost h-[30px] rounded-md px-2.5 text-[12.5px] font-medium" onClick={() => ws.setFull(true)}><Maximize2 size={14} /> Full view</button>}
        <a className="btn-ghost h-[30px] rounded-md px-2.5 text-[12.5px] font-medium" href={`/api/v1/estimates/${ws.estimate!.id}/export/cashflow.xlsx`}><Download size={14} /> Excel</a>
      </div>
      <div className="mt-4"><SCurve width={ws.full ? 930 : 415} height={ws.full ? 210 : 235} /></div>
      <table className={`mt-3.5 text-[12px] ${ws.full ? 'w-[930px]' : 'w-full'}`}>
        <thead><tr className="text-[#3b4652]"><th className="py-1.5 pl-1 text-left font-medium">Month</th>{cols.map((col) => <th key={col} className="py-1.5 pr-1 text-right font-medium">{col}</th>)}</tr></thead>
        <tbody>
          {months.map((month) => {
            const expanded = open.includes(month.month);
            return (
              <Fragment key={month.month}>
                <tr className={`cursor-pointer border-t border-line ${expanded ? 'bg-[#f4f3ef]' : 'hover:bg-paper'}`} onClick={() => setOpen(expanded ? open.filter((each) => each !== month.month) : [...open, month.month])}>
                  <td className="py-[6px] pl-1">{expanded ? <ChevronDown size={12} className="mr-1 inline" /> : <ChevronRight size={12} className="mr-1 inline" />}{monthName(parse(`${month.month}-01`))}</td>
                  {cols.map((col) => <td key={col} className="py-[6px] pr-1 text-right">{naira(cell(month, col))}</td>)}
                </tr>
                {expanded && (
                  <tr className="bg-[#f4f3ef]">
                    <td colSpan={cols.length + 1} className="px-4 pb-2">
                      {month.activities.map(({ id, days, amount }) => (
                        <button key={id} className="grid w-full grid-cols-[1fr_auto] gap-3 py-[5px] text-left hover:text-primary" onClick={() => { ws.setActivity(id); const refs = plan.byId.get(id)?.refs; if (refs?.length) ws.show(refs); }}>
                          <span><b>{id}</b> {plan.byId.get(id)?.name} <small className="text-[10.5px] text-[#6b7581]">· {days} d</small></span>
                          <span className={ws.full ? 'pr-[150px]' : ''}>{naira(amount)}</span>
                        </button>
                      ))}
                      {month.activities.length === 0 && <p className="py-1.5 text-[#6b7581]">Preliminaries only this month.</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="pb-24 pt-3 text-[11.5px] text-[#6b7581]">Contract terms (advance, retention, payment delay) are not modelled yet.</p>
    </div>
  );
}
