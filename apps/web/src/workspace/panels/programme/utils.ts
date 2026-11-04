import { parse } from '@/lib/calendar';
import { day as dayName } from '@/lib/format';
import { type Activity, type Plan } from '../../state';

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

export const range = (activity: Activity) => (activity.summary ? '' : `${dayName(parse(activity.startDate))} – ${dayName(parse(activity.finishDate))}`);
