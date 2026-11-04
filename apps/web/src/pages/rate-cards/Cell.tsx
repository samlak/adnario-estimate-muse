import { DASH } from './Dash';

/** One value, typed over in place: saved when the person leaves it or presses Enter; Escape puts it back. A number
 * cell takes "14,500" or "₦8500", and blank. */
export function Cell({ value, label, onSave, number = false, canEdit = true, className = '' }: {
  value: string; label: string; onSave: (text: string) => void; number?: boolean; canEdit?: boolean; className?: string;
}) {
  if (!canEdit) return <span className={`block truncate px-1.5 ${number ? 'text-right' : ''} ${className}`}>{value || DASH}</span>;
  return (
    <input
      key={value} // a change from elsewhere shows
      aria-label={label}
      defaultValue={value}
      placeholder="—"
      className={`h-[30px] w-full rounded-md border border-transparent bg-transparent px-1.5 placeholder:text-[#b5bbc1] hover:border-line focus:border-primary-300 focus:bg-white focus:outline-none ${number ? 'text-right' : ''} ${className}`}
      onBlur={(event) => { const text = event.target.value.trim(); if (text !== value) onSave(text); }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') { event.currentTarget.value = value; event.currentTarget.blur(); }
      }}
    />
  );
}

/** A number as typed, or null when the cell is cleared. */
export function toNumber(text: string): number | null {
  const cleaned = text.replace(/[^\d.]/g, '');
  return cleaned ? Number(cleaned) : null;
}

export const shown = (value: number | null | undefined) => (value == null ? '' : value.toLocaleString('en-US'));
