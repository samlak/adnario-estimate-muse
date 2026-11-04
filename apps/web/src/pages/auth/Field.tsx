import { type ReactNode } from 'react';

export function Field({ label, icon, hint, children }: { label: string; icon?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-medium">{label}</span>
      <span className="relative block">
        {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7b848e]">{icon}</span>}
        {children}
      </span>
      {hint && <span className="mt-1.5 block text-[12.5px] text-[#8a929b]">{hint}</span>}
    </label>
  );
}
