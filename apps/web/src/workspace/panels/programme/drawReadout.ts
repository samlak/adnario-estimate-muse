import { day as dayName, naira } from '@/lib/format';
import { iso, weekOf, type Plan } from '../../state';
import { workDone, underWay } from './utils';

/** The readout as the recording shows it: the card over the model, top right, with every activity under way. */
export function drawReadout(pen: CanvasRenderingContext2D, width: number, unit: number, plan: Plan, at: number, money: boolean, project: string) {
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
