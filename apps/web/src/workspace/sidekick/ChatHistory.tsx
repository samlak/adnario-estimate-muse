import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Confirm } from '@/components/ui/Confirm';
import { ago } from '@/lib/format';
import type { ChatSummary } from './types';

/** This person's chats on the project, newest first: one reopens, and one can be deleted after asking. */
export function ChatHistory({ chats, projectName, onOpen, onDelete }: {
  chats: ChatSummary[]; projectName: string; onOpen: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [forgetting, setForgetting] = useState<ChatSummary | null>(null);
  return (
    <div className="sidekickBody">
      <ul className="sidekickHistory">
        {chats.map((chat) => (
          <li key={chat.id}>
            <button onClick={() => onOpen(chat.id)}>
              <span>{chat.title}</span>
              <small>{ago(chat.updated_at)}</small>
            </button>
            <button className="ico" title="Delete this chat" onClick={() => setForgetting(chat)}>
              <Trash2 />
            </button>
          </li>
        ))}
      </ul>
      {chats.length === 0 && <p className="sidekickEmpty">No chats on {projectName} yet.</p>}
      {forgetting && (
        <Confirm
          title={`Delete “${forgetting.title}”?`}
          message="The chat and its answers are gone for good."
          onConfirm={() => { setForgetting(null); onDelete(forgetting.id); }}
          onCancel={() => setForgetting(null)}
        />
      )}
    </div>
  );
}
