import { useState } from 'react';
import { DASH } from './Dash';

/** A price, typed over in place. */
export function PriceCell({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return <button className="hover:text-primary" onClick={() => setEditing(true)}>{value == null ? DASH : value.toLocaleString('en-US')}</button>;
  return (
    <input
      autoFocus
      type="number"
      min={0}
      className="h-7 w-24 rounded border border-primary-300 px-1.5 text-right"
      defaultValue={value ?? ''}
      onBlur={(event) => { const next = Number(event.target.value); if (event.target.value !== '' && next >= 0 && next !== value) onChange(next); setEditing(false); }}
      onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
    />
  );
}
