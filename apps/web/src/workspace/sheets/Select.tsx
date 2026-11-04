import { ChevronDown } from 'lucide-react';

export const Select = ({ value, onChange, options, className = '' }: { value: string; onChange: (value: string) => void; options: [string, string][]; className?: string }) => (
  <span className={`relative inline-block ${className}`}>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-[37px] w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-8 text-[14px]">
      {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select>
    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7b848e]" />
  </span>
);
