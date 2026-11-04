import type { Card, Work } from './state';

/** A new piece of long work, before its first event. */
export function newWork(kind: Work['kind'], body?: FormData): Work {
  return { kind, stages: [], done: false, mapped: 0, started: Date.now(), feed: [], decided: {}, file: body instanceof FormData ? (body.get('file') as File | null)?.name : undefined };
}

/** The work after one event from the server's stream. */
export function withEvent(now: Work, event: string, data: unknown): Work {
  const given = data as Record<string, unknown>;
  if (event === 'stage') return { ...now, stages: [...now.stages.filter((stage) => stage.name !== given.name), given as Work['stages'][number]] };
  if (event === 'mapped') {
    const cards = (given.cards as Card[] | undefined) ?? [];
    const decided = { ...now.decided, ...(given.confidence as Record<string, Card['confidence']>) };
    for (const card of cards) decided[card.key] = card.confidence;
    return { ...now, mapped: Object.keys(decided).length, decided, feed: [...[...cards].reverse(), ...now.feed] };
  }
  if (event === 'log') return { ...now, feed: [{ text: String(given.text) }, ...now.feed] };
  if (event === 'seen') return { ...now, seen: String(given.text) };
  if (event === 'catalogue') return { ...now, catalogue: given.types as Record<string, string[]> };
  if (event === 'error') return { ...now, error: String(given.message), done: true };
  if (event === 'stopped') return { ...now, error: 'Stopped', done: true };
  if (event === 'result') return { ...now, done: true };
  return now;
}
