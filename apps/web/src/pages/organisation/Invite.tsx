import { useState } from 'react';
import { errorText } from '@/lib/api';
import { send, type Role } from '@/lib/store';
import { inviteLink } from './utils';
import { RoleSelect } from './RoleSelect';

export function Invite({ onClose, onDone }: { onClose: () => void; onDone: (link: string) => void }) {
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
