import { X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { initials } from '@/lib/format';

export function Logo({ white = false, className = 'h-7' }: { white?: boolean; className?: string }) {
  return (
    <img
      src="/adnario-logo-dark.png"
      alt="Adnario"
      className={className}
      style={white ? { filter: 'brightness(0) invert(1)' } : undefined}
    />
  );
}

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-primary-100 font-bold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(name)}
    </span>
  );
}

/** A panel that slides in from the right over a dimmed page. */
export function Sheet({ title, onClose, width = 404, children, actions, footer }: {
  title: string;
  onClose: () => void;
  width?: number;
  children: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="sheet" style={{ width: `min(${width}px, 100vw)` }} role="dialog" aria-label={title}>
        <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-line px-5">
          <h2 className="flex-1 text-[19px] font-bold">{title}</h2>
          {actions}
          <button onClick={onClose} title="Close" className="text-[#59636e] hover:text-ink">
            <X size={20} />
          </button>
        </header>
        <div className="thin-scroll flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="flex shrink-0 justify-end gap-2.5 border-t border-line px-5 py-3.5">{footer}</footer>}
      </aside>
    </>
  );
}

/** Asks first: every delete does (README §6). */
export function Confirm({ title, message, label = 'Delete', onConfirm, onCancel }: {
  title: string;
  message: string;
  label?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/30 p-4" onClick={onCancel}>
      <div className="card w-full max-w-sm p-6" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-1.5 text-sm text-[#6b7581]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn bg-danger text-white hover:bg-danger-600" onClick={onConfirm}>{label}</button>
        </div>
      </div>
    </div>
  );
}

const TONE = {
  High: 'bg-success-50 text-success',
  Medium: 'bg-accent-50 text-[#a26a12]',
  Low: 'bg-warning-50 text-warning',
  Excluded: 'bg-[#eef0f2] text-[#6b7581]',
  'Not mapped': 'bg-danger-50 text-danger',
} as const;
export const Conf = ({ value }: { value: keyof typeof TONE }) => <span className={`pill ${TONE[value]}`}>{value}</span>;

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
