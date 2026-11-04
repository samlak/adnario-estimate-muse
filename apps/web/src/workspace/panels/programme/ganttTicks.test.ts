import { describe, expect, it } from 'vitest';
import { ticksOf } from './ganttTicks';

const origin = new Date(2026, 0, 29); // Thursday 29 January 2026

describe('the Gantt scale', () => {
  it('ticks every day and names the month on its first', () => {
    const ticks = ticksOf(origin, 3, 10, 'Days');
    expect(ticks.map((tick) => tick.label)).toEqual(['29', '30', '31', '1']);
    expect(ticks[3]).toEqual({ x: 30, label: '1', month: 'Feb 2026' });
  });

  it('ticks each Monday, and the first of a month', () => {
    const ticks = ticksOf(origin, 7, 10, 'Weeks');
    expect(ticks).toEqual([{ x: 30, label: '', month: 'Feb 2026' }, { x: 40, label: '2', month: undefined }]);
  });

  it('ticks only months', () => {
    expect(ticksOf(origin, 40, 1, 'Months').map((tick) => tick.month)).toEqual(['Feb 2026', 'Mar 2026']);
  });
});
