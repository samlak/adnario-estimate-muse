import type { Panel } from './state';
import type { RAIL } from './constants';

/** The rail down the left: a button per panel; the open one is lit, and pressing it again closes it. */
export function Rail({ items, shown, open }: { items: typeof RAIL; shown: Panel | null; open: (panel: Panel | null) => void }) {
  return (
    <nav className="flex w-[44px] shrink-0 flex-col items-center gap-[7px] border-r border-line pt-3">
      {items.map(({ id: item, icon: Icon, label }) => (
        <button key={item} title={label} onClick={() => open(shown === item ? null : item)} className={`grid h-[33px] w-[33px] place-items-center rounded-lg ${shown === item ? 'bg-primary-50 text-primary' : 'text-[#5b6570] hover:bg-paper'}`}>
          <Icon size={18} strokeWidth={1.6} />
        </button>
      ))}
    </nav>
  );
}
