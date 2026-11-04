import { useSyncExternalStore } from 'react';

/** Under Tailwind's md breakpoint: a phone. The workspace drops the 3D model and its tools there. */
const list = () => window.matchMedia?.('(max-width: 767px)'); // ponytail: absent in jsdom, so tests see a desktop
const subscribe = (change: () => void) => {
  list()?.addEventListener('change', change);
  return () => list()?.removeEventListener('change', change);
};
export const useMobile = () => useSyncExternalStore(subscribe, () => list()?.matches ?? false);
