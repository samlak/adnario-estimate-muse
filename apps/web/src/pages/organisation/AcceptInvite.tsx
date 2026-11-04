import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { errorText } from '@/lib/api';
import { forget, ROLE_NAME, send, useApi, type Role } from '@/lib/store';

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
