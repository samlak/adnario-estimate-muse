/** The sidekick, Adnario AI: an "Adnario AI" button at the workspace's bottom right opens a chat about this project (its models,
 * takeoff, BOQ, programme and cash flow), answered by the AI from read-only look-ups (apps/api/app/features/sidekick).
 * Chats are kept on the server, one person's own per project, and reopen from the history. While it works, every step
 * shows as it comes (what it says it will check, each look-up, which opens to show what it answered, and how long the
 * AI took to get there); once answered, they fold into one line above the answer. Links in an answer act:
 * an element is shown in 3D, a week moves the 4D there, a BOQ item opens in its bill, an activity opens in the
 * programme, a panel (cost, cash flow…) opens. */

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useMe } from '@/lib/store';
import { AskBox } from './AskBox';
import { ChatHistory } from './ChatHistory';
import { ChatMessages } from './ChatMessages';
import { Hello } from './Hello';
import { SidekickButton } from './SidekickButton';
import { SidekickHeader } from './SidekickHeader';
import type { ChatSummary, SidekickLinks } from './types';
import { useChat } from './useChat';

export function Sidekick({ estimateId, projectId, projectName, links }: {
  estimateId: string;
  projectId: string;
  projectName: string;
  links: SidekickLinks;
}) {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [past, setPast] = useState<ChatSummary[] | null>(null); // the history, while it is shown
  const box = useRef<HTMLTextAreaElement | null>(null);
  const chat = useChat(estimateId, () => box.current?.focus());

  const fresh = () => { chat.fresh(); setPast(null); };
  const ask = (question: string) => { if (!question.trim() || chat.busy) return; setDraft(''); setPast(null); void chat.ask(question); };
  const showHistory = async () => {
    setPast([]);
    setPast(await api<ChatSummary[]>(`/projects/${projectId}/sidekick/chats`).catch(() => []));
  };
  const reopen = async (id: string) => { await chat.reopen(id); setPast(null); };
  const forget = async (id: string) => {
    await api(`/sidekick/chats/${id}`, { method: 'DELETE' }).catch(() => {});
    setPast((now) => now?.filter((each) => each.id !== id) ?? null);
    if (chat.chatId.current === id) chat.fresh();
  };

  if (!open) return <SidekickButton projectName={projectName} onOpen={() => setOpen(true)} />;
  const title = past ? 'Your chats' : (chat.name ?? chat.said[0]?.text ?? 'Adnario AI');
  return (
    <section className="sidekick" id="sidekick" aria-label="Adnario AI">
      <SidekickHeader
        title={title}
        history={!!past}
        busy={chat.busy}
        canStartNew={!!chat.said.length || !!past}
        onHistory={() => (past ? setPast(null) : void showHistory())}
        onNew={fresh}
        onMinimise={() => setOpen(false)}
        onClose={() => { setOpen(false); if (!chat.busy) fresh(); }}
      />
      {past ? (
        <ChatHistory chats={past} projectName={projectName} onOpen={(id) => void reopen(id)} onDelete={(id) => void forget(id)} />
      ) : (
        <div className="sidekickBody">
          {chat.said.length === 0
            ? <Hello firstName={me.name.split(' ')[0]} projectName={projectName} onAsk={ask} />
            : <ChatMessages said={chat.said} busy={chat.busy} links={links} />}
        </div>
      )}
      <AskBox ref={box} draft={draft} setDraft={setDraft} busy={chat.busy} projectName={projectName} onAsk={() => ask(draft)} onStop={chat.stop} onFocusQuestion={() => setPast(null)} />
      <p className="sidekickNote">Answers are based only on {projectName}.</p>
    </section>
  );
}
