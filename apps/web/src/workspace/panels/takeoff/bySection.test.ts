import { expect, it } from 'vitest';
import { bySection } from './bySection';

it('groups lines under their sections in the order they come', () => {
  const lines = [{ section: 'A', n: 1 }, { section: 'A', n: 2 }, { section: 'B', n: 3 }, { section: 'A', n: 4 }];
  expect(bySection(lines).map(([section, items]) => [section, items.map((each) => each.n)])).toEqual([['A', [1, 2]], ['B', [3]], ['A', [4]]]);
});
