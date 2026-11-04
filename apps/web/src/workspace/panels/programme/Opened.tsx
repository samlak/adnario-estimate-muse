import { Play } from 'lucide-react';
import { naira } from '@/lib/format';
import { useWs, type Activity } from '../../state';
import { range } from './utils';

export function Opened({ activity }: { activity: Activity }) {
  const ws = useWs();
  const plan = ws.plan!;
  const follows = activity.follows.map((id) => plan.byId.get(id)).filter(Boolean) as Activity[];
  const leads = plan.leaves.filter((each) => each.follows.includes(activity.id));
  return (
    <section className="mt-3 rounded-xl border border-primary-200 bg-primary-50/40 px-3 py-2.5">
      <b className="text-[12.5px]">{activity.id} {activity.name}</b>
      <p className="mt-0.5 text-[#59636e]">{range(activity)} · {activity.days} working days{activity.critical ? ' · critical' : ''}</p>
      {follows.length > 0 && <p className="mt-1">Follows: {follows.map((each) => `${each.id} ${each.name}`).join('; ')}</p>}
      {leads.length > 0 && <p className="mt-1">Leads to: {leads.map((each) => `${each.id} ${each.name}`).join('; ')}</p>}
      {ws.money && activity.work.length > 0 && (
        <ul className="mt-1.5 border-t border-line pt-1">
          {activity.work.map((work, index) => <li key={index} className="flex gap-2 py-0.5"><span className="w-9 text-[#6b7581]">{ws.result?.refs[work.code]}</span><span className="flex-1">{work.description}</span><span>{work.qty == null ? '' : work.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })} {work.unit}</span></li>)}
          <li className="pt-1 font-semibold">{naira(activity.cost ?? 0)}</li>
        </ul>
      )}
      <div className="mt-1.5 flex gap-3">
        <button className="font-semibold text-primary" onClick={() => ws.setDay(activity.start)}>Play from its start</button>
        {activity.refs.length > 0 && <button className="font-semibold text-primary" onClick={() => ws.show(activity.refs)}>Show its {activity.refs.length} elements</button>}
      </div>
    </section>
  );
}
