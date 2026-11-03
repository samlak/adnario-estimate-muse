/** One thing the AI did on the way to an answer: a look-up, or what it said it would check (backend schemas.py). */
export type Step = { id?: string | null; tool?: string | null; args?: Record<string, unknown> | null; result?: string | null; note?: string | null; seconds?: number | null };
export type Message = { role: 'user' | 'assistant'; text: string; steps: Step[] };
export type ChatSummary = { id: string; title: string; updated_at: string };
export type Chat = ChatSummary & { messages: Message[] };
