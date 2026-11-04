import { useState } from 'react';
import { send, useMe } from '@/lib/store';
import { Organisation } from './Organisation';

export function Details() {
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
