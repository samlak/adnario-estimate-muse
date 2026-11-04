/** A fake API for component tests: fetch answers from a table of "METHOD /path" → JSON, or a list of events to stream. */
import { vi } from 'vitest';

type Answer = unknown | { stream: [string, unknown][] } | { status: number; body?: unknown };

export function fakeServer(routes: Record<string, Answer>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '')}`;
    if (!(key in routes)) return new Response(JSON.stringify({ detail: `No route ${key}` }), { status: 404 });
    const answer = routes[key] as Record<string, unknown>;
    if (answer && 'stream' in answer) {
      const text = (answer.stream as [string, unknown][]).map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
      return new Response(text);
    }
    if (answer && 'status' in answer) return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status as number });
    return new Response(answer === undefined ? null : JSON.stringify(answer), { status: answer === undefined ? 204 : 200 });
  });
}
