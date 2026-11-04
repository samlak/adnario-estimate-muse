import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { ROLE_NAME, send, useMe } from '@/lib/store';

export function Profile() {
  const { me, firm } = useMe();
  const [name, setName] = useState(me.name);
  return (
    <div className="card max-w-[608px] space-y-5 p-[21px]">
      <div className="flex items-center gap-3.5">
        <Avatar name={me.name} size={48} />
        <div><b className="block text-[17px]">{me.name}</b><span className="text-[13.5px] text-[#6b7581]">{ROLE_NAME[me.role]} · {firm.name}</span></div>
      </div>
      <label className="block"><span className="label">Name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="block"><span className="label">Email</span><input className="input bg-paper" value={me.email} readOnly /></label>
      <button className="btn-primary" disabled={!name.trim() || name === me.name} onClick={() => void send('/me', 'PATCH', { name: name.trim() }, '/me')}>Save</button>
    </div>
  );
}
