import { useCallback, useState } from 'react';

/** State kept in the browser between visits (the panel open, the player's day); works without storage too. */
export function useRemembered<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved == null ? fallback : JSON.parse(saved);
    } catch {
      return fallback;
    }
  });
  const keep = useCallback((next: T) => {
    setValue(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* not kept */ }
  }, [key]);
  return [value, keep];
}
