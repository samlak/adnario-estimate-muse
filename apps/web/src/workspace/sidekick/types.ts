/** One thing the AI did on the way to an answer: a look-up, or what it said it would check (backend schemas.py). */
export type Step = { id?: string | null; tool?: string | null; args?: Record<string, unknown> | null; result?: string | null; note?: string | null; seconds?: number | null };
export type Message = { role: 'user' | 'assistant'; text: string; steps: Step[] };
export type ChatSummary = { id: string; title: string; updated_at: string };
export type Chat = ChatSummary & { messages: Message[] };

/** What a link in an answer does in the workspace. */
export type SidekickLinks = {
  element: (ref: string, label: string) => void;
  week: (week: number) => void;
  line: (code: string) => void;
  activity: (code: string) => void; // by its ID in the firm's programme
  panel: (name: string) => void; // a rail panel: models, tree, estimate, cost, programme, cashflow
};
