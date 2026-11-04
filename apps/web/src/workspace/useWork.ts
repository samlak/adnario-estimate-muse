import { useCallback, useEffect, useState } from 'react';
import { errorText } from '@/lib/api';
import { streamRun } from './sidekick/stream';
import type { Estimate, Work } from './state';
import { newWork, withEvent } from './work';

/** The long work the workspace follows (run, BOQ, link, programme): its events as they stream, and work already
 * running on the server (started here before, or by someone else) followed from its start. */
export function useWork(estimate: Estimate | undefined, refresh: () => void, onRun: () => void) {
  const [work, setWork] = useState<Work | null>(null);

  const follow = useCallback((kind: Work['kind'], path: string, body?: FormData, method: 'POST' | 'GET' = 'POST') => {
    setWork(newWork(kind, body));
    if (kind === 'run') onRun();
    const update = (change: (now: Work) => Work) => setWork((now) => (now && now.kind === kind ? change(now) : now));
    streamRun(path, body, (event, data) => update((now) => withEvent(now, event, data)), method)
      .catch((error) => update((now) => ({ ...now, error: errorText(error), done: true })))
      .finally(() => { refresh(); setTimeout(() => setWork((now) => (now?.done && !now.error ? null : now)), 1500); });
  }, [refresh, onRun]);

  const running = estimate?.running.join(',') ?? '';
  useEffect(() => {
    if (!estimate || work) return;
    const kind = estimate.running[0] as Work['kind'] | undefined;
    if (kind) follow(kind, `/estimates/${estimate.id}/follow/${kind}`, undefined, 'GET');
  }, [running, estimate?.id]);

  return { work, follow };
}
