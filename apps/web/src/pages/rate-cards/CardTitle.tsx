import { Pencil } from 'lucide-react';
import { useState } from 'react';

/** The card's name, renamed in place, and when its prices are from. */
export function CardTitle({ name, pricesOf, rows, onRename }: { name: string; pricesOf: string; rows: number; onRename: (name: string) => void }) {
  const [naming, setNaming] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {naming ? (
        <input
          autoFocus
          aria-label="Card name"
          className="input h-9 w-72 text-[19px] font-bold"
          defaultValue={name}
          onBlur={(event) => { const next = event.target.value.trim(); if (next && next !== name) onRename(next); setNaming(false); }}
          onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
        />
      ) : (
        <h2 className="text-[19px] font-bold tracking-[-0.01em]">{name}</h2>
      )}
      <button title="Rename" onClick={() => setNaming(true)} className="text-[#7b848e]"><Pencil size={16} /></button>
      <span className="ml-5 text-[13.5px] text-[#7b848e]">prices of {new Date(pricesOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {rows} rows</span>
    </div>
  );
}
