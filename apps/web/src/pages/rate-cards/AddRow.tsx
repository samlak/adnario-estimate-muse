import { Plus } from 'lucide-react';
import { useState } from 'react';

/** The table's last row: type a name and press Enter to add a row of the kind the tab shows. */
export function AddRow({ what, columns, onAdd }: { what: string; columns: number; onAdd: (name: string) => void }) {
  const [text, setText] = useState('');
  return (
    <tr>
      <td colSpan={columns} className="px-3 py-2">
        <label className="flex items-center gap-2 text-[#7b848e]">
          <Plus size={15} />
          <input className="h-[30px] flex-1 bg-transparent text-[14px] text-ink placeholder:text-[#9aa1a9] focus:outline-none" placeholder={`Add ${what}: type its description and press Enter`}
            value={text} onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && text.trim()) { onAdd(text.trim()); setText(''); } }} />
        </label>
      </td>
    </tr>
  );
}
