import { X } from 'lucide-react';
import type { ReactNode } from 'react';

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
        <header className="flex min-h-[60px] shrink-0 items-center gap-4 border-b border-line px-5 py-3">
          <h2 className="flex-1 text-[19px] font-bold leading-[1.3]">{title}</h2>
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
