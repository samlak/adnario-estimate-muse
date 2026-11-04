/** Organisation (README §6, Admin): Team and Organisation details. There is no email: an invitation is a link the
 * Admin shares. A firm always keeps at least one Admin. */
import { useState } from 'react';
import { Team } from './Team';
import { Details } from './Details';

export function Organisation() {
  const [tab, setTab] = useState<'team' | 'details'>('team');
  return (
    <div className="pt-[13px]">
      <div className="flex gap-[26px] border-b border-line">
        {(['team', 'details'] as const).map((id) => (
          <button key={id} onClick={() => setTab(id)} className={`-mb-px border-b-2 pb-2.5 text-[14.5px] ${tab === id ? 'border-primary-500 font-semibold' : 'border-transparent text-[#6b7581]'}`}>
            {id === 'team' ? 'Team' : 'Organisation details'}
          </button>
        ))}
      </div>
      {tab === 'team' ? <Team /> : <Details />}
    </div>
  );
}
