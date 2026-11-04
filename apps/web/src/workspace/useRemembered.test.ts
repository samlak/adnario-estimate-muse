import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useRemembered } from './useRemembered';

beforeEach(() => localStorage.clear());

it('starts from the fallback and keeps what is set', () => {
  const { result } = renderHook(() => useRemembered('k', 1));
  expect(result.current[0]).toBe(1);
  act(() => result.current[1](5));
  expect(result.current[0]).toBe(5);
  expect(renderHook(() => useRemembered('k', 1)).result.current[0]).toBe(5);
});

it('works when storage fails', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  const { result } = renderHook(() => useRemembered('k', 'a'));
  act(() => result.current[1]('b'));
  expect(result.current[0]).toBe('b');
});
