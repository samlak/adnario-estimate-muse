import { Search } from 'lucide-react';
import type { Tab } from './groups';

/** The tabs (all, rates, each kind of price) and the search. */
export function RateTabs({ tabs, tab, setTab, query, setQuery }: { tabs: [Tab, string][]; tab: Tab; setTab: (tab: Tab) => void; query: string; setQuery: (query: string) => void }) {
  return (
    <div className="mt-[21px] flex items-center gap-3.5">
      <div className="flex rounded-xl bg-canvas p-1">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`h-[32px] rounded-lg px-3 text-[13.5px] ${tab === id ? 'bg-white font-semibold shadow-sm' : 'text-[#59636e]'}`}>{label}</button>
        ))}
      </div>
      <label className="relative w-full max-w-[338px]">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a929b]" />
        <input className="input h-[40px] pl-10" placeholder="Search rows" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
    </div>
  );
}
