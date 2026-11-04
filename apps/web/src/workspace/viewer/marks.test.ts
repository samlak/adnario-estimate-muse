import { describe, expect, it } from 'vitest';
import { escape, marksHtml, place, type Anchor } from './marks';
import type { Mark } from './types';

const anchor = (key: string, x: number, y: number, kind: Mark['kind'] = 'dot'): Anchor => ({ mark: { key, gids: [], kind, color: 'red' }, at: [x, y], ids: [] });
const flat = (at: number[]) => [at[0], at[1]] as [number, number];

describe('marks on the model', () => {
  it('drops marks off screen', () => {
    expect(place([anchor('a', -5, 10), anchor('b', 10, 999)], flat, 100, 100, null)).toEqual([]);
  });

  it('merges close dots into a count, but never the open one or a number', () => {
    const spots = place([anchor('a', 10, 10), anchor('b', 12, 12), anchor('c', 13, 13, 'number')], flat, 100, 100, null);
    expect(spots.map((spot) => spot.items.length)).toEqual([2, 1]);
    expect(place([anchor('a', 10, 10), anchor('b', 12, 12)], flat, 100, 100, 'b')).toHaveLength(2);
  });

  it('draws a cluster as a count and an open mark with its label, escaped', () => {
    const cluster = marksHtml(place([anchor('a', 10, 10), anchor('b', 11, 11)], flat, 100, 100, null), null);
    expect(cluster).toContain('class="mk cluster"');
    expect(cluster).toContain('>2</button>');
    const one = { x: 5, y: 5, items: [{ ...anchor('k"1', 5, 5), mark: { key: 'k"1', gids: [], kind: 'number' as const, color: 'red', text: '1', label: '<b>' } }] };
    const html = marksHtml([one], 'k"1');
    expect(html).toContain('mk number open');
    expect(html).toContain('data-key="k&quot;1"');
    expect(html).toContain('<span class="mk-label">&lt;b&gt;</span>');
  });

  it('escapes HTML', () => {
    expect(escape('a & <b> "c"')).toBe('a &amp; &lt;b&gt; &quot;c&quot;');
  });
});
