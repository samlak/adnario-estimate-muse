/** Organisation (README §6, Admin): Team and Organisation details. There is no email: an invitation is a link the
 * Admin shares. A firm always keeps at least one Admin. */
import { ChevronDown, Link2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, Confirm, Logo } from '@/components/ui';
import { errorText } from '@/lib/api';
import { ago } from '@/lib/format';
import { forget, ROLE_NAME, send, useApi, useMe, type Role } from '@/lib/store';

type Person = { id: string; name: string; email: string; role: Role; seen_at: string | null; invited: boolean };
const inviteLink = (path: string) => `${location.origin}${path}`;

function RoleSelect({ value, disabled, onChange }: { value: Role; disabled?: boolean; onChange: (role: Role) => void }) {
  return (
    <span className="relative inline-block w-[180px]">
      <select
        className={`h-[34px] w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-8 text-[14px] ${disabled ? 'text-[#9aa1a9]' : ''}`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as Role)}
      >
        {(Object.keys(ROLE_NAME) as Role[]).map((role) => <option key={role} value={role}>{ROLE_NAME[role]}</option>)}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7b848e]" />
    </span>
  );
}

export function Organisation() {
  const [tab, setTab] = useState<'team' | 'details'>('team');
  return (
    <div className="pt-[13px]">
      <div className="flex gap-[26px] border-b border-line">
        {(['team', 'details'] as const).map((id) => (
          <button key={id} onClick={() => setTab(id)} className={`-mb-px border-b-2 pb-2.5 text-[14.5px] ${tab === id ? 'border-primary-500 font-semibold' : 'border-transparent text-[#6b7581]'}`}>
            {id === 'team' ? 'Team' : 'Organisation details'}
          </button>
        ))}
      </div>
      {tab === 'team' ? <Team /> : <Details />}
    </div>
  );
}

function Team() {
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
    <div className="card mt-[22px] overflow-hidden">
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
  );
}

function Invite({ onClose, onDone }: { onClose: () => void; onDone: (link: string) => void }) {
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('qs');
  const [made, setMade] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/30 p-4" onClick={onClose}>
      <form
        className="card w-full max-w-md space-y-4 p-6"
        onClick={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const { link } = await send<{ link: string }>('/team/invite', 'POST', { email: email.trim(), role }, '/team');
            setMade(link);
            onDone(link);
          } catch (error) {
            setError(errorText(error));
          }
        }}
      >
        <h3 className="text-lg font-bold">Invite someone</h3>
        {made ? (
          <>
            <p className="text-sm text-[#59636e]">Share this link with them; it is copied. Opening it, they set their name and password.</p>
            <input className="input font-mono text-[13px]" readOnly value={inviteLink(made)} onFocus={(event) => event.target.select()} />
            <div className="flex justify-end"><button type="button" className="btn-primary" onClick={onClose}>Done</button></div>
          </>
        ) : (
          <>
            <label className="block"><span className="label">Email</span><input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label className="block"><span className="label">Role</span><RoleSelect value={role} onChange={setRole} /></label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Get a link</button></div>
          </>
        )}
      </form>
    </div>
  );
}

function Details() {
  const { firm } = useMe();
  const [form, setForm] = useState({ name: firm.name, currency: firm.currency });
  return (
    <div className="card mt-[22px] max-w-[608px] px-[21px] pb-[21px] pt-[22px]">
      <label className="block"><span className="label">Organisation name</span><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label className="mt-[18px] block"><span className="label">Currency</span><input className="input" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} /></label>
      <button className="btn-primary mt-[18px] h-[33px] rounded-lg" onClick={() => void send('/org', 'PATCH', form, '/me')}>Save</button>
    </div>
  );
}

/** Opening an invitation: who invited you and as what; set your name and password and you are in. */
export function AcceptInvite() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: person, error: missing } = useApi<{ email: string; role: Role; firm: string; invited_by: string | null }>(`/invites/${id}`);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  if (missing) return <p className="p-10 text-center">This invitation is no longer valid.</p>;
  if (!person) return null;
  return (
    <div className="grid min-h-full place-items-center bg-paper p-4">
      <form
        className="card w-full max-w-[422px] space-y-5 p-[30px]"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await send(`/invites/${id}`, 'POST', { name: name.trim(), password });
            forget();
            navigate('/');
          } catch (error) {
            setError(errorText(error));
          }
        }}
      >
        <Logo className="h-6" />
        <div>
          <h1 className="text-[24px] font-bold">Join {person.firm}</h1>
          <p className="mt-1 text-sm text-[#6b7581]">{person.invited_by ? `${person.invited_by} invited you` : 'You are invited'} as {ROLE_NAME[person.role]}.</p>
        </div>
        <label className="block"><span className="label">Your name</span><input className="input" required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="block"><span className="label">Password</span><input className="input" type="password" minLength={10} required value={password} onChange={(event) => setPassword(event.target.value)} /><small className="mt-1.5 block text-[13px] text-[#8a929b]">At least 10 characters.</small></label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary h-[44px] w-full">Join</button>
      </form>
    </div>
  );
}
