/** What the pages read from the API: each path fetched once and kept, shared by every component that asks for it,
 * and fetched again when something changes it (`reload`) or the server says it changed (live updates). */
import { useEffect, useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

type Entry = { data?: unknown; error?: Error; loading: boolean; version: number };
const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const tell = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function fetchInto(path: string) {
  const before = cache.get(path);
  cache.set(path, { ...before, loading: true, version: (before?.version ?? 0) + 1 });
  const mine = cache.get(path)!.version;
  api(path)
    .then((data) => cache.get(path)?.version === mine && cache.set(path, { data, loading: false, version: mine }))
    .catch((error) => cache.get(path)?.version === mine && cache.set(path, { data: before?.data, error, loading: false, version: mine }))
    .finally(tell);
}

/** Fetch these paths again: every one that starts with a prefix given. */
export function reload(...prefixes: string[]) {
  for (const path of cache.keys()) if (prefixes.some((prefix) => path.startsWith(prefix))) fetchInto(path);
}

/** Put a value the server just answered with, without asking again. */
export function put(path: string, data: unknown) {
  cache.set(path, { data, loading: false, version: (cache.get(path)?.version ?? 0) + 1 });
  tell();
}

export function forget() {
  cache.clear();
  tell();
}

export function useApi<T>(path: string | null): { data: T | undefined; error?: Error; loading: boolean } {
  useSyncExternalStore(subscribe, () => version);
  useEffect(() => {
    if (path && !cache.has(path)) fetchInto(path);
  }, [path]);
  const entry = path ? cache.get(path) : undefined;
  return { data: entry?.data as T | undefined, error: entry?.error, loading: !entry || entry.loading };
}

/** Send a change, then fetch again what it changes. */
export async function send<T = unknown>(path: string, method: string, body?: unknown, ...changes: string[]): Promise<T> {
  const form = body instanceof FormData;
  const answer = await api<T>(path, {
    method,
    headers: body === undefined || form ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });
  if (changes.length) reload(...changes);
  return answer;
}

export const ROLE_NAME = { admin: 'Admin', qs: 'Quantity surveyor', contributor: 'Contributor', viewer: 'Viewer' } as const;
export type Role = keyof typeof ROLE_NAME;
export type Person = { id: string; name: string; email: string; role: Role };
export type Firm = { id: string; name: string; currency: string };
type Me = { person: Person; firm: Firm; can: string[] };

/** The person signed in, with their firm; `me` is undefined while it loads or when nobody is signed in. */
export function useMe() {
  const { data, error, loading } = useApi<Me>('/me');
  return { me: data?.person as Person, firm: data?.firm as Firm, permissions: data?.can ?? [], error, loading: loading && !data };
}

/** What each role may do; the server decides in the end. */
export const can = (role: Role) => ({
  seeMoney: role !== 'contributor',
  seeRateCards: role === 'admin' || role === 'qs',
  editEstimate: role === 'admin' || role === 'qs',
  manageOrg: role === 'admin',
});
