import { afterEach, describe, expect, it, vi } from 'vitest';
import { ago, day, initials, monthName, naira, num, short } from './format';

afterEach(() => vi.useRealTimers());

describe('format', () => {
  it('writes naira in whole naira', () => {
    expect(naira(1234.6)).toBe('₦1,235');
    expect(naira(0)).toBe('₦0');
  });

  it('shortens big amounts for an axis', () => {
    expect(short(1_510_000_000)).toBe('₦1.51bn');
    expect(short(757_000_000)).toBe('₦757.0m');
    expect(short(9_500)).toBe('₦9,500');
  });

  it('keeps up to the digits asked for', () => {
    expect(num(1234.5678)).toBe('1,234.57');
    expect(num(2, 3)).toBe('2');
  });

  it('says how long ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T12:00:00Z'));
    expect(ago('2026-10-24T11:59:30Z')).toBe('just now');
    expect(ago('2026-10-24T11:55:00Z')).toBe('5 min ago');
    expect(ago('2026-10-24T09:00:00Z')).toBe('3 h ago');
    expect(ago('2026-10-23T09:00:00Z')).toBe('yesterday');
    expect(ago('2026-10-21T12:00:00Z')).toBe('3 days ago');
    expect(ago('2026-10-25T12:00:00Z')).toBe('just now'); // a clock a little ahead is not "in the future"
  });

  it('takes two initials', () => {
    expect(initials('Ada Lovelace Byron')).toBe('AL');
    expect(initials('samlak')).toBe('S');
  });

  it('names days and months', () => {
    const date = new Date(2026, 11, 1);
    expect(day(date)).toBe('1 Dec');
    expect(day(date, true)).toBe('1 Dec 2026');
    expect(monthName(date)).toBe('Dec 2026');
    expect(monthName(date, false)).toBe('Dec');
  });
});
