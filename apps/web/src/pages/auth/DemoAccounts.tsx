import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { ROLE_NAME, useApi } from '@/lib/store';
import { DemoFirm } from './types';

export function DemoAccounts({ onPick }: { onPick: (email: string) => void }) {
  const [open, setOpen] = useState(false);
  const firms = useApi<DemoFirm[]>('/auth/demo').data ?? [];
  if (!firms.length) return null;
  return (
    <div className="absolute right-[18px] top-[15px] z-10">
      <button
        className="flex h-10 items-center gap-2.5 rounded-xl bg-white px-3.5 text-[15px] font-semibold shadow-card hover:bg-paper"
        onClick={() => setOpen(!open)}
      >
        <Users size={17} /> Demo accounts {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="absolute right-0 mt-2.5 w-[372px] rounded-2xl border border-line bg-white p-3.5 shadow-pop">
          <p className="px-1 text-[12.5px] font-semibold tracking-[0.14em] text-[#6b7581]">SIGN IN AS</p>
          {firms.map((firm, index) => (
            <details key={firm.firm} open={index === 0} className="group mt-2.5">
              <summary className="cursor-pointer list-none px-1 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                <span className="mr-1.5 inline-block text-[11px] transition-transform group-open:rotate-90">▶</span>
                {firm.firm}
              </summary>
              <div className="mt-2.5 space-y-2.5">
                {firm.people
                  .map((person) => (
                    <button
                      key={person.email}
                      className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left hover:border-primary-200 hover:bg-primary-50"
                      onClick={() => onPick(person.email)}
                    >
                      <Avatar name={person.name} size={38} />
                      <span>
                        <b className="block text-[15px] font-semibold">{person.name}</b>
                        <span className="text-[13.5px] text-[#7b848e]">{ROLE_NAME[person.role]}</span>
                      </span>
                    </button>
                  ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
