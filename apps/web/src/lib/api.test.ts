import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, errorText, messageOf } from './api';

const answer = (status: number, body?: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status, statusText: 'Bad' }));

afterEach(() => vi.restoreAllMocks());

describe('api', () => {
  it('calls under /api/v1 and returns the JSON', async () => {
    const fetch = answer(200, { ok: true });
    await expect(api('/projects')).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith('/api/v1/projects', undefined);
  });

  it('returns nothing for 204', async () => {
    answer(204);
    await expect(api('/client-errors', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('throws the server’s own words, with the status', async () => {
    answer(409, { detail: 'That email already has an account.' });
    await expect(api('/auth/signup')).rejects.toMatchObject({ message: 'That email already has an account.', status: 409 });
  });

  it('falls back to the status text when the detail is not words', async () => {
    expect(messageOf({ detail: [{ loc: ['body'] }] }, 'Bad')).toBe('Bad');
    answer(422, { detail: [] });
    await expect(api('/x')).rejects.toMatchObject({ message: 'Bad', status: 422 });
  });

  it('says plainly when the server is down', () => {
    expect(errorText(new ApiError('Bad Gateway', 502))).toMatch(/not running/);
    expect(errorText(new ApiError('Not found', 404))).toBe('Not found');
    expect(errorText('odd')).toBe('odd');
  });
});
