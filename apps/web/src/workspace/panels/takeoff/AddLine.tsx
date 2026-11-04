import { Plus } from 'lucide-react';
import { useState } from 'react';
import { errorText } from '@/lib/api';
import { useWs } from '../../state';
import { SECTIONS, UNITS } from './constants';

export function AddLine() {
  const ws = useWs();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ section: 'Substructure', description: '', qty: '', unit: 'm²', rate: '' });
  const [error, setError] = useState('');
  if (!open) return <button className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-primary" onClick={() => setOpen(true)}><Plus size={13} /> Add a line</button>;
  return (
    <form className="mt-2 space-y-1.5 rounded-xl border border-line p-2.5 text-[12px]" onSubmit={(event) => {
      event.preventDefault();
      ws.edit({ op: 'add_line', section: form.section, description: form.description, unit: form.unit, qty: Number(form.qty || 0), rate: form.rate === '' ? null : Number(form.rate) })
        .then(() => { setOpen(false); setForm({ ...form, description: '', qty: '', rate: '' }); })
        .catch((error) => setError(errorText(error)));
    }}>
      <select className="h-7 w-full rounded border border-line" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })}>{SECTIONS.map((each) => <option key={each}>{each}</option>)}</select>
      <input className="h-7 w-full rounded border border-line px-1.5" placeholder="Description" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      <div className="flex gap-1.5">
        <input className="h-7 w-20 rounded border border-line px-1.5" placeholder="Qty" type="number" min={0} step="any" value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} />
        <select className="h-7 rounded border border-line" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{UNITS.map((each) => <option key={each}>{each}</option>)}</select>
        <input className="h-7 w-24 rounded border border-line px-1.5" placeholder="Rate ₦" type="number" min={0} value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} />
        <span className="flex-1" />
        <button type="button" className="text-[#59636e]" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn-primary h-7 px-2.5 text-[12px]">Add</button>
      </div>
      {error && <p className="text-danger">{error}</p>}
    </form>
  );
}
