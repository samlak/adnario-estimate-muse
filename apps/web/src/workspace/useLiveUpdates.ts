import { useEffect } from 'react';

/** Every change on the project (a model converted, an estimate saved, a comment) is told over the live stream;
 * a burst of changes refreshes once. */
export function useLiveUpdates(projectId: string, refresh: () => void, wait = 400) {
  useEffect(() => {
    const source = new EventSource(`/api/v1/projects/${projectId}/live`);
    let timer: ReturnType<typeof setTimeout>;
    source.addEventListener('change', () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, wait);
    });
    return () => { source.close(); clearTimeout(timer); };
  }, [projectId, refresh, wait]);
}
