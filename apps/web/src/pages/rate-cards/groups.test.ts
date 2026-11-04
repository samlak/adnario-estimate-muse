import { describe, expect, it } from 'vitest';
import { prices, rates } from '@/testing/data';
import { groupsOf, tabsOf } from './groups';

const RATES = rates;
const PRICES = prices;

describe('rate card rows', () => {
  it('heads work items by section, then prices by kind A to Z', () => {
    const groups = groupsOf('all', '', RATES, PRICES);
    expect(groups.map((group) => group.title)).toEqual(['Substructure', 'Frame', 'Material', 'Labour']);
    expect(groups[2].prices!.map((each) => each.name)).toEqual(['Cement', 'Sand']);
  });

  it('shows one tab and what a search finds', () => {
    expect(groupsOf('LABOUR', '', RATES, PRICES).map((group) => group.title)).toEqual(['Labour']);
    expect(groupsOf('all', 'excav', RATES, PRICES)).toEqual([{ title: 'Substructure', rates: [RATES[0]] }]);
    expect(groupsOf('rates', 'nothing', RATES, PRICES)).toEqual([]);
  });

  it('counts each tab', () => {
    expect(tabsOf(RATES, PRICES).map(([, label]) => label)).toEqual(['All 6', 'Rates 3', 'Material 2', 'Labour 1', 'Plant 0']);
  });
});
