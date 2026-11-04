import { Trash2 } from 'lucide-react';

/** A row's delete button: shown on hover, and it asks first. */
export const RemoveRow = ({ onClick }: { onClick: () => void }) => (
  <button title="Delete this row" aria-label="Delete this row" onClick={onClick} className="grid h-[30px] w-[30px] place-items-center rounded-lg text-[#9aa1a9] opacity-0 hover:bg-danger-50 hover:text-danger focus:opacity-100 group-hover:opacity-100">
    <Trash2 size={15} />
  </button>
);
