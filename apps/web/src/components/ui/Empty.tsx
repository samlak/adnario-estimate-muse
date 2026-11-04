import { type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** A panel with nothing to show yet: what it needs, centred. */
export const Empty = ({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) => (
  <div className="grid h-full place-items-center px-8 text-center">
    <div>
      <Icon size={44} strokeWidth={1.3} className="mx-auto text-[#c3c9d0]" />
      <b className="mt-3 block text-[14px]">{title}</b>
      <p className="mt-1 text-[13px] leading-[1.55] text-[#59636e]">{children}</p>
    </div>
  </div>
);
