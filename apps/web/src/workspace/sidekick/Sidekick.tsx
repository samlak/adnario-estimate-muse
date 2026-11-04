/** The sidekick, Adnario AI: an "Adnario AI" button at the workspace's bottom right opens a chat about this project (its models,
 * takeoff, BOQ, programme and cash flow), answered by the AI from read-only look-ups (apps/api/app/features/sidekick).
 * Chats are kept on the server, one person's own per project, and reopen from the history. While it works, every step
 * shows as it comes (what it says it will check, each look-up, which opens to show what it answered, and how long the
 * AI took to get there); once answered, they fold into one line above the answer. Links in an answer act:
 * an element is shown in 3D, a week moves the 4D there, a BOQ item opens in its bill, an activity opens in the
 * programme, a panel (cost, cash flow…) opens. */

import { ArrowUp, ChevronDown, History, Sparkles, Square, SquarePen, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Confirm } from '@/components/ui';
import { api, errorText } from '@/lib/api';
import { ago } from '@/lib/format';
import { useMe } from '@/lib/store';
import type { Chat, ChatSummary, Message, SidekickLinks, Step } from './types';
import { streamRun } from './stream';
import { Steps, Wave, CopyButton, Answer, seconds } from './Messages';

const SUGGESTIONS = [
  'What is the total project cost?',
  'Which BOQ items have no rate yet?',
  'Which level costs the most?',
  'What is happening in week 3?',
];

const MAX_BOX = 160; // px the question box grows to before it scrolls

export function Sidekick({
  estimateId,
  projectId,
  projectName,
  links,
}: {
  estimateId: string;
  projectId: string;
  projectName: string;
  links: SidekickLinks;
}) {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [past, setPast] = useState<ChatSummary[] | null>(null); // the history, while it is shown
  const [name, setName] = useState<string | null>(null); // the chat's name, once the AI gives it one
  const [forgetting, setForgetting] = useState<ChatSummary | null>(null);
  const chatId = useRef<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  // a block body: scrollIntoView returns a Promise in recent Chrome, and an effect may only return a cleanup
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [said]);
  // the box grows with what is typed; a scrollbar only once it is as tall as it gets
  useEffect(() => {
    const area = box.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, MAX_BOX)}px`;
    area.style.overflowY = area.scrollHeight > MAX_BOX ? 'auto' : 'hidden';
  }, [draft, open, past]);

  const fresh = () => {
    chatId.current = null;
    setSaid([]);
    setName(null);
    setPast(null);
  };

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setSaid((now) => [
      ...now,
      { role: 'user', text: question.trim(), steps: [] },
      { role: 'assistant', text: '', steps: [] },
    ]);
    setDraft('');
    setBusy(true);
    const update = (change: (answer: Message) => Message) =>
      setSaid((now) => [...now.slice(0, -1), change(now[now.length - 1])]);
    try {
      await streamRun(
        `/estimates/${estimateId}/sidekick`,
        { question: question.trim(), chat_id: chatId.current },
        (event, data) => {
          const value = data as {
            id?: string;
            text?: string;
            name?: string;
            args?: object;
            seconds?: number;
            message?: string;
            title?: string;
          };
          if (event === 'chat') chatId.current = value.id ?? null;
          if (event === 'title') setName(value.title ?? null);
          if (event === 'token') update((answer) => ({ ...answer, text: answer.text + value.text }));
          // what it said before looking something up is its plan: a step, not the answer
          if (event === 'tool')
            update((answer) => ({
              ...answer,
              text: '',
              steps: [
                ...answer.steps,
                ...(answer.text.trim() ? [{ note: answer.text.trim() }] : []),
                { id: value.id, tool: value.name, args: value.args as Step['args'], seconds: value.seconds },
              ],
            }));
          if (event === 'result')
            update((answer) => ({
              ...answer,
              // look-ups run side by side, so a result finds its own step
              steps: answer.steps.map((step) => (step.id === value.id ? { ...step, result: value.text } : step)),
            }));
          if (event === 'error') update((answer) => ({ ...answer, text: value.message ?? 'The sidekick failed.' }));
        },
      );
    } catch (error) {
      update((answer) => ({ ...answer, text: errorText(error) }));
    } finally {
      update((answer) => ({ ...answer, text: answer.text || 'Stopped.' }));
      setBusy(false);
      box.current?.focus();
    }
  };

  const stop = () => {
    if (chatId.current) void api(`/sidekick/chats/${chatId.current}/stop`, { method: 'POST' }).catch(() => {});
  };

  const showHistory = async () => {
    setPast([]);
    setPast(await api<ChatSummary[]>(`/projects/${projectId}/sidekick/chats`).catch(() => []));
  };

  const reopen = async (id: string) => {
    const chat = await api<Chat>(`/sidekick/chats/${id}`);
    chatId.current = chat.id;
    setSaid(chat.messages);
    setName(chat.title);
    setPast(null);
  };

  const forget = async (id: string) => {
    await api(`/sidekick/chats/${id}`, { method: 'DELETE' }).catch(() => {});
    setPast((now) => now?.filter((each) => each.id !== id) ?? null);
    if (chatId.current === id) fresh();
  };

  if (!open) {
    return (
      <button
        className="sidekickBtn"
        id="sidekickBtn"
        title={`Ask Adnario AI about ${projectName}`}
        onClick={() => setOpen(true)}
      >
        <Sparkles /> Adnario AI
      </button>
    );
  }
  const title = past ? 'Your chats' : (name ?? said[0]?.text ?? 'Adnario AI');
  return (
    <section className="sidekick" id="sidekick" aria-label="Adnario AI">
      <header>
        <Sparkles className="mark" />
        <b title={title}>{title}</b>
        <button
          className={past ? 'ico on' : 'ico'}
          title="Your chats"
          disabled={busy}
          onClick={() => (past ? setPast(null) : void showHistory())}
        >
          <History />
        </button>
        <button className="ico" title="New chat" disabled={busy || (!said.length && !past)} onClick={fresh}>
          <SquarePen />
        </button>
        <button className="ico" title="Minimise" onClick={() => setOpen(false)}>
          <ChevronDown />
        </button>
        <button
          className="ico"
          title="Close (the chat stays in your history)"
          onClick={() => {
            setOpen(false);
            if (!busy) fresh();
          }}
        >
          <X />
        </button>
      </header>
      {past ? (
        <div className="sidekickBody">
          <ul className="sidekickHistory">
            {past.map((chat) => (
              <li key={chat.id}>
                <button onClick={() => void reopen(chat.id)}>
                  <span>{chat.title}</span>
                  <small>{ago(chat.updated_at)}</small>
                </button>
                <button className="ico" title="Delete this chat" onClick={() => setForgetting(chat)}>
                  <Trash2 />
                </button>
              </li>
            ))}
          </ul>
          {past.length === 0 && <p className="sidekickEmpty">No chats on {projectName} yet.</p>}
          {forgetting && (
            <Confirm
              title={`Delete “${forgetting.title}”?`}
              message="The chat and its answers are gone for good."
              onConfirm={() => {
                setForgetting(null);
                void forget(forgetting.id);
              }}
              onCancel={() => setForgetting(null)}
            />
          )}
        </div>
      ) : (
        <div className="sidekickBody">
          {said.length === 0 ? (
            <div className="sidekickHello">
              <h2>
                Hi {me.name.split(' ')[0]}, what would you like to know about <em>{projectName}</em>?
              </h2>
              <p>Ask about its model, takeoff, BOQ, programme or cash flow.</p>
              <div className="sidekickChips">
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} onClick={() => void ask(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            said.map((each, index) => {
              if (each.role === 'user')
                return (
                  <div key={index} className="said user">
                    {each.text}
                  </div>
                );
              const working = busy && index === said.length - 1;
              return (
                <div key={index} className="said assistant">
                  {each.steps.length > 0 && <Steps steps={each.steps} working={working} />}
                  {working && !each.text && (
                    <div className="working">
                      <Wave /> {each.steps.length ? 'Working it out' : 'Thinking'}…
                    </div>
                  )}
                  <Answer text={each.text} links={links} />
                  {working && each.text && <Wave />}
                  {!working && each.text && <CopyButton text={each.text} />}
                </div>
              );
            })
          )}
          <div ref={end} />
        </div>
      )}
      <form
        className="sidekickAsk"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) stop();
          else void ask(draft);
        }}
      >
        <textarea
          ref={box}
          rows={1}
          aria-label="Your question"
          placeholder={`Ask about ${projectName}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter asks; Shift+Enter starts a new line
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (past) setPast(null);
              void ask(draft);
            }
          }}
        />
        {busy ? (
          <button className="send" title="Stop">
            <Square />
          </button>
        ) : (
          <button className="send" disabled={!draft.trim()} title="Ask (Enter)" onClick={() => setPast(null)}>
            <ArrowUp />
          </button>
        )}
      </form>
      <p className="sidekickNote">Answers are based only on {projectName}.</p>
    </section>
  );
}

