import { Link2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Confirm } from '@/components/ui/Confirm';
import { errorText } from '@/lib/api';
import { ago } from '@/lib/format';
import { send, useApi, useMe, type Role } from '@/lib/store';
import { Person } from './types';
import { inviteLink } from './utils';
import { RoleSelect } from './RoleSelect';
import { Invite } from './Invite';

export function Team() {
  const { me } = useMe();
  const people = useApi<Person[]>('/team').data ?? [];
  const [error, setError] = useState('');
  const act = (work: Promise<unknown>) => work.then(() => setError('')).catch((error) => setError(errorText(error)));
  const admins = people.filter((person) => person.role === 'admin' && !person.invited).length;
  const [removing, setRemoving] = useState<Person | null>(null);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const sorted = [...people].sort((a, b) => Number(!!b.invited) - Number(!!a.invited) || a.name.localeCompare(b.name));
  const copy = (id: string, link: string) => void navigator.clipboard.writeText(inviteLink(link)).then(() => { setCopied(id); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  return (
    <div className="card thin-scroll mt-[22px] overflow-x-auto">
      <div className="min-w-[900px]">
      <div className="grid grid-cols-[400px_342px_1fr_auto] items-center border-b border-line py-2 pl-4 pr-4">
        <span className="th px-0">Person</span><span className="th px-0">Role</span><span className="th px-0">Status</span>
        <button className="btn-primary h-[33px] rounded-lg" onClick={() => setInviting(true)}><UserPlus size={16} /> Invite someone</button>
      </div>
      {error && <p className="border-b border-line px-4 py-2 text-sm text-danger">{error}</p>}
      {sorted.map((person) => {
        const self = person.id === me.id;
        const lastAdmin = person.role === 'admin' && admins <= 1;
        return (
          <div key={person.id} className="grid h-[66px] grid-cols-[400px_342px_1fr_auto] items-center border-b border-line pl-4 pr-4 last:border-0">
            <span className="flex items-center gap-3">
              <Avatar name={person.name} size={34} />
              <span><b className="block text-[14.5px] font-semibold">{person.name}</b><span className="text-[13px] text-[#7b848e]">{person.email}</span></span>
            </span>
            <span>
              <RoleSelect
                value={person.role}
                disabled={self || lastAdmin}
                onChange={(role) => act(send(`/team/${person.id}`, 'PATCH', { role }, '/team'))}
              />
            </span>
            <span className="text-[13.5px] text-[#7b848e]">
              {person.invited ? <span className="pill bg-accent-50 text-[#a26a12]">Invited</span> : person.seen_at ? `Seen ${ago(person.seen_at)}` : 'Active'}
            </span>
            <span className="flex gap-2">
              {person.invited && <button className="btn-ghost h-[34px]" onClick={() => act(send<{ link: string }>(`/team/${person.id}/link`, 'POST').then(({ link }) => copy(person.id, link)))}><Link2 size={15} /> {copied === person.id ? 'Copied' : 'Copy link'}</button>}
              {!self && !lastAdmin && <button className="btn-ghost h-[34px]" onClick={() => setRemoving(person)}>Remove</button>}
            </span>
          </div>
        );
      })}
      {removing && (
        <Confirm
          title={`Remove ${removing.name}?`}
          message={removing.invited ? 'Their invitation link stops working.' : 'They lose access to every project of the firm.'}
          label="Remove"
          onCancel={() => setRemoving(null)}
          onConfirm={() => { void act(send(`/team/${removing.id}`, 'DELETE', undefined, '/team')); setRemoving(null); }}
        />
      )}
      {inviting && <Invite onClose={() => setInviting(false)} onDone={(link) => copy('new', link)} />}
      </div>
    </div>
  );
}
