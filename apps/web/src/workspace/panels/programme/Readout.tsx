import { day as dayName, naira } from '@/lib/format';
import { iso, useWs, weekOf } from '../../state';
import { workDone, underWay } from './utils';

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
