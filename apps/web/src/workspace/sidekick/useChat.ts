import { useRef, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { withAnswerEvent } from './answerEvents';
import { streamRun } from './stream';
import type { Chat, Message } from './types';

/** One chat with the sidekick: what has been said, the answer streaming in, its name, and starting, reopening or
 * stopping it. The server keeps the chat. */
export function useChat(estimateId: string, onAnswered?: () => void) {
  const [said, setSaid] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string | null>(null); // the chat's name, once the AI gives it one
  const chatId = useRef<string | null>(null);

  const fresh = () => {
    chatId.current = null;
    setSaid([]);
    setName(null);
  };

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setSaid((now) => [...now, { role: 'user', text: question.trim(), steps: [] }, { role: 'assistant', text: '', steps: [] }]);
    setBusy(true);
    const update = (change: (answer: Message) => Message) => setSaid((now) => [...now.slice(0, -1), change(now[now.length - 1])]);
    try {
      await streamRun(`/estimates/${estimateId}/sidekick`, { question: question.trim(), chat_id: chatId.current }, (event, data) => {
        const value = data as { id?: string; title?: string };
        if (event === 'chat') chatId.current = value.id ?? null;
        else if (event === 'title') setName(value.title ?? null);
        else update((answer) => withAnswerEvent(answer, event, data));
      });
    } catch (error) {
      update((answer) => ({ ...answer, text: errorText(error) }));
    } finally {
      update((answer) => ({ ...answer, text: answer.text || 'Stopped.' }));
      setBusy(false);
      onAnswered?.();
    }
  };

  const stop = () => {
    if (chatId.current) void api(`/sidekick/chats/${chatId.current}/stop`, { method: 'POST' }).catch(() => {});
  };

  const reopen = async (id: string) => {
    const chat = await api<Chat>(`/sidekick/chats/${id}`);
    chatId.current = chat.id;
    setSaid(chat.messages);
    setName(chat.title);
  };

  return { said, busy, name, chatId, ask, stop, fresh, reopen };
}
