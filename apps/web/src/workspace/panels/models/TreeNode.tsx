import { useState } from 'react';
import { Tick } from './Tick';

export function Node({ label, on, onChange, level, open, children }: { label: string; on: boolean; onChange: () => void; level: number; open?: boolean; children?: React.ReactNode }) {
  const [expanded, setExpanded] = useState(open ?? false);
  return (
    <li>
      <div className="flex h-[23.5px] items-center gap-1.5 text-[14px]" style={{ paddingLeft: 14 + level * 15 }}>
        <button className="w-3 text-[9px] text-[#59636e]" onClick={() => setExpanded(!expanded)}>{children ? (expanded ? '▾' : '▸') : ''}</button>
        <Tick on={on} onChange={onChange} />
        <span className="truncate" title={label}>{label}</span>
      </div>
      {expanded && children && <ul>{children}</ul>}
    </li>
  );
}
