import { expect, it } from 'vitest';
import { size, toggle } from './utils';

it('toggles an item in a list', () => {
  expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
  expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
});

it('sizes a file in MB', () => {
  expect(size(1.5 * 1024 * 1024)).toBe('1.5 MB');
});
