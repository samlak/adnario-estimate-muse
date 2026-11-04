import { type ReactNode } from 'react';

export const Segment = ({ title, on, disabled, onClick, children }: { title: string; on?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) => (
  <button title={title} aria-pressed={on} disabled={disabled} onClick={onClick} className={`grid h-[34px] w-9 place-items-center border-r border-line last:border-0 disabled:text-[#c3c7cb] ${on ? 'bg-primary-50 text-primary' : 'bg-white text-[#3b4652] hover:bg-paper'}`}>{children}</button>
);
