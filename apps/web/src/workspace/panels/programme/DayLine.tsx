import { day as dayName, naira } from '@/lib/format';
import type { Activity } from '../../state';

/** In full view, the day the player is on: its date, what is under way, and the value of work done. */
export function DayLine({ date, day, days, underWay, money, work }: {
  date: Date; day: number; days: number; underWay: Activity[]; money: boolean; work: { done: number; month: number };
}) {
  return (
    <p className="flex gap-3 px-3 pb-1.5 text-[12px] text-[#59636e]">
      <b className="text-ink">{dayName(date, true)}</b> Day {day + 1} of {days}
      <span className="flex-1 truncate">Under way: {underWay.length ? `${underWay.slice(0, 1).map((each) => each.name).join(', ')}${underWay.length > 1 ? ` and ${underWay.length - 1} more` : ''}` : 'nothing'}</span>
      {money && <span>Work done {naira(work.done)} · this month {naira(work.month)}</span>}
    </p>
  );
}
