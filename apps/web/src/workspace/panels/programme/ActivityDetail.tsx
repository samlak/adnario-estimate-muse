import { ArrowLeft, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useConfirm } from '@/components/ui/useConfirm';
import { errorText } from '@/lib/api';
import { naira } from '@/lib/format';
import { Select } from '../../sheets/Select';
import { useWs, type Activity, type ProgrammeEdit } from '../../state';
import { range } from './utils';

/** An activity opened from the programme (its elements shown and flown to on the model): its name and working days,
 * typed over; what it waits for, each opening that activity, added and removed; the BOQ work under it, each opening
 * that BOQ item. */
export function ActivityDetail({ activity }: { activity: Activity }) {
  const ws = useWs();
  const plan = ws.plan!;
  const { ask, dialog } = useConfirm();
  const [adding, setAdding] = useState({ before: '', kind: 'FS', lag: '0' });
  const [error, setError] = useState('');
  useEffect(() => {
    if (activity.refs.length) ws.show(activity.refs, true);
    setAdding({ before: '', kind: 'FS', lag: '0' });
    setError('');
  }, [activity.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (edit: Omit<ProgrammeEdit, 'id'>) => ws.editProgramme({ id: activity.id, ...edit }).then(() => setError(''), (failed) => setError(errorText(failed)));
  const all = ws.estimate!.programme!.links;
  const links = all.filter((link) => link.after === activity.id);
  // what already waits on it, through its links, cannot be waited for: the link would go round in a loop
  const waiting = new Set<number>();
  for (let edge = [activity.id]; edge.length;) {
    edge = all.filter((link) => edge.includes(link.before) && !waiting.has(link.after)).map((link) => link.after);
    edge.forEach((id) => waiting.add(id));
  }
  const others = plan.leaves.filter((each) => each.id !== activity.id && !waiting.has(each.id) && !links.some((link) => link.before === each.id));
  const programmed = activity.programmed ?? activity.days;
  const openLine = (code: string) => { ws.open('takeoff'); ws.setBoqTab('boq'); ws.setLine(code); };

  return (
    <div className="pb-6 text-[13.5px]">
      <button className="flex items-center gap-1.5 font-semibold text-primary" onClick={() => ws.setActivity(null)}><ArrowLeft size={16} /> All activities</button>
      <p className="mt-4 text-[12px] font-bold tracking-[0.1em] text-primary">ID {activity.code}</p>
      {ws.editor ? (
        <input key={`name-${activity.id}-${activity.name}`} aria-label="Activity name" className="input mt-1.5 h-[46px] text-[17px] font-bold" defaultValue={activity.name}
          onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== activity.name) void change({ name }); }}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} />
      ) : <h2 className="mt-1 text-[17px] font-bold">{activity.name}</h2>}
      <p className="mt-2 text-[#59636e]">{range(activity)} · {activity.critical ? 'on the critical path' : `${activity.float} days of float`}</p>

      <label className="mt-3 block">
        <span className="text-[#59636e]">Working days</span>
        <input key={`days-${activity.id}-${activity.days}`} type="number" min={0} aria-label="Working days" disabled={!ws.editor} className="input mt-1.5 h-[44px]" defaultValue={activity.days}
          onBlur={(event) => { const days = Number(event.target.value); if (event.target.value !== '' && days >= 0 && days !== activity.days) void change({ days }); }}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} />
      </label>
      <p className="mt-1.5 text-[#59636e]">{activity.days === programmed ? 'As in the programme.' : `Typed: the programme has ${programmed}. What waits for it moves with it.`}</p>
      {error && <p className="mt-2 text-danger">{error}</p>}

      <h4 className="mt-6 text-[12px] font-bold tracking-[0.1em] text-[#59636e]">WAITS FOR</h4>
      {links.length === 0 && <p className="mt-2 text-[#59636e]">Nothing: it can start as the programme has it.</p>}
      <ul className="mt-2 space-y-2">
        {links.map((link) => {
          const before = plan.byId.get(link.before);
          return (
            <li key={link.before} className="flex items-center gap-2">
              <button className="font-semibold text-primary hover:underline" onClick={() => ws.setActivity(link.before)}>{before?.code} {before?.name}</button>
              <span className="text-[#59636e]">{link.kind === 'SS' ? 'to start' : 'to finish'}{link.lag ? `, then ${link.lag} days` : ''}</span>
              {ws.editor && (
                <button title="It no longer waits for this" className="text-[#3b4652] hover:text-danger"
                  onClick={() => ask({ title: `Stop waiting for ${before?.name ?? 'it'}?`, message: `${activity.name} no longer waits for it. The programme is worked out again.`, label: 'Remove', onConfirm: () => void change({ remove_link: link.before }) })}>
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {ws.editor && (
        <div className="mt-3 space-y-2">
          <Select className="w-full" value={adding.before} onChange={(before) => setAdding({ ...adding, before })} options={[['', 'Add: waits for…'], ...others.map((each): [string, string] => [String(each.id), `${each.code} ${each.name}`])]} />
          <div className="flex gap-2">
            <Select className="flex-1" value={adding.kind} onChange={(kind) => setAdding({ ...adding, kind })} options={[['FS', 'to finish'], ['SS', 'to start']]} />
            <input type="number" aria-label="Then working days" title="Then working days" className="input h-[37px] w-20" value={adding.lag} onChange={(event) => setAdding({ ...adding, lag: event.target.value })} />
            <button className="btn-ghost h-[37px] rounded-lg px-4" disabled={!adding.before}
              onClick={() => { void change({ add_link: { before: Number(adding.before), kind: adding.kind as 'FS' | 'SS', lag: Number(adding.lag) || 0 } }); setAdding({ before: '', kind: 'FS', lag: '0' }); }}>Add</button>
          </div>
        </div>
      )}

      <h4 className="mt-6 text-[12px] font-bold tracking-[0.1em] text-[#59636e]">BOQ WORK UNDER IT</h4>
      {activity.work.length === 0 ? (
        <p className="mt-2 leading-[1.5] text-[#59636e]">None: it puts no measured work in place (or the AI found none of the BOQ in it).</p>
      ) : (
        <ul className="mt-1.5">
          {activity.work.map((work, index) => (
            <li key={index}>
              <button className="flex w-full gap-2 border-b border-line py-1.5 text-left hover:text-primary" onClick={() => openLine(work.code)}>
                <span className="w-10 shrink-0 font-semibold">{ws.result?.refs[work.code] ?? work.code}</span>
                <span className="flex-1">{work.description}</span>
                {work.qty != null && <span className="whitespace-nowrap text-[#59636e]">{work.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })} {work.unit}</span>}
              </button>
            </li>
          ))}
          {ws.money && <li className="flex py-1.5 font-semibold"><span className="flex-1">Cost</span>{naira(activity.cost ?? 0)}</li>}
        </ul>
      )}
      <p className="mt-3 text-[#59636e]">{activity.refs.length} elements in the model.</p>
      {dialog}
    </div>
  );
}
