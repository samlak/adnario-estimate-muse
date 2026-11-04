/** The workspace's sheets: People on the project, the Conversation (comments, mentions, attachments), and the
 * models' Versions. README §7. */
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Sheet } from '@/components/ui/Sheet';
import { errorText } from '@/lib/api';
import { ROLE_NAME, send, useApi, useMe } from '@/lib/store';
import { type Project } from '../state';
import { Member } from './types';
import { Select } from './Select';

export function People({ project, onClose }: { project: Project; onClose: () => void }) {
  const { me } = useMe();
  const path = `/projects/${project.id}/members`;
  const people = (useApi<(Member & { invited: boolean })[]>('/team').data ?? []).filter((person) => !person.invited);
  const members = useApi<Member[]>(path).data ?? [];
  const others = people.filter((person) => !members.some((member) => member.id === person.id));
  const [who, setWho] = useState('');
  const [access, setAccess] = useState<'edit' | 'view'>('edit');
  const [error, setError] = useState('');
  const manage = me.role === 'admin' || me.role === 'qs';
  const act = (work: Promise<unknown>) => work.then(() => setError('')).catch((error) => setError(errorText(error)));
  return (
    <Sheet title="People" onClose={onClose} width={381}>
      <div className="px-5 py-4">
        {manage && (
          <>
            <Select className="w-full" value={who} onChange={setWho} options={others.length ? [['', 'Choose someone in the firm'], ...others.map((person) => [person.id, `${person.name} · ${ROLE_NAME[person.role]}`] as [string, string])] : [['', 'Everyone is already on it']]} />
            <div className="mt-2 flex gap-2">
              <Select className="flex-1" value={access} onChange={(value) => setAccess(value as 'edit' | 'view')} options={[['edit', 'Can edit'], ['view', 'Can view']]} />
              <button className="btn-primary h-[37px]" disabled={!who} onClick={() => { void act(send(path, 'POST', { person_id: who, access }, path)); setWho(''); }}><UserPlus size={15} /> Add</button>
            </div>
            {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
            <p className="mt-2.5 text-[12px] leading-[1.5] text-[#6b7581]">They are told, and the project appears on their dashboard. Can view: they look and comment, but change nothing, whatever their role allows elsewhere.</p>
          </>
        )}
        <ul className="mt-3">
          {members.map((member) => {
            const person = member;
            const choosable = person.role === 'qs' || person.role === 'contributor';
            return (
              <li key={member.id} className="flex items-center gap-2.5 border-b border-line py-3 last:border-0">
                <Avatar name={person.name} size={30} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[14px] font-semibold">{person.name}</b>
                  <span className="text-[12px] text-[#6b7581]">{ROLE_NAME[person.role]}{choosable ? '' : ` · ${member.access === 'edit' ? 'Can edit' : 'Can view'}`}</span>
                </span>
                {choosable && manage && (
                  <Select className="w-[100px]" value={member.access} onChange={(value) => void act(send(`${path}/${person.id}`, 'PATCH', { access: value }, path))} options={[['edit', 'Can edit'], ['view', 'Can view']]} />
                )}
                {manage && <button className="text-[12.5px] text-[#6b7581] hover:text-danger" onClick={() => void act(send(`${path}/${person.id}`, 'DELETE', undefined, path))}>Remove</button>}
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
