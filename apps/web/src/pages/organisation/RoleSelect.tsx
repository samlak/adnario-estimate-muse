import { ChevronDown } from 'lucide-react';
import { ROLE_NAME, type Role } from '@/lib/store';

export function RoleSelect({ value, disabled, onChange }: { value: Role; disabled?: boolean; onChange: (role: Role) => void }) {
  return (
    <span className="relative inline-block w-[180px]">
      <select
        className={`h-[34px] w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-8 text-[14px] ${disabled ? 'text-[#9aa1a9]' : ''}`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as Role)}
      >
        {(Object.keys(ROLE_NAME) as Role[]).map((role) => <option key={role} value={role}>{ROLE_NAME[role]}</option>)}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7b848e]" />
    </span>
  );
}
