import { ChevronDown, History, Sparkles, SquarePen, X } from 'lucide-react';

/** The open sidekick's bar: its title, the history, a new chat, minimise and close. */
export function SidekickHeader({ title, history, busy, canStartNew, onHistory, onNew, onMinimise, onClose }: {
  title: string; history: boolean; busy: boolean; canStartNew: boolean;
  onHistory: () => void; onNew: () => void; onMinimise: () => void; onClose: () => void;
}) {
  return (
    <header>
      <Sparkles className="mark" />
      <b title={title}>{title}</b>
      <button className={history ? 'ico on' : 'ico'} title="Your chats" disabled={busy} onClick={onHistory}>
        <History />
      </button>
      <button className="ico" title="New chat" disabled={busy || !canStartNew} onClick={onNew}>
        <SquarePen />
      </button>
      <button className="ico" title="Minimise" onClick={onMinimise}>
        <ChevronDown />
      </button>
      <button className="ico" title="Close (the chat stays in your history)" onClick={onClose}>
        <X />
      </button>
    </header>
  );
}
