import { describe, expect, it } from 'vitest';
import shippedPrices from '../../../../overview/rate-card/prices.json';
import shippedRates from '../../../../overview/rate-card/rates.json';
import { lineOf, outputOf, rateOf, type Price, type Rate } from './ratecard';

// the shipped library, checked against the rates the sample BOQ prints
const prices = new Map<string, Price>((shippedPrices as Price[]).map((each) => [each.name, each]));
const rates = shippedRates as unknown as Rate[];
const items = new Map(rates.map((each) => [each.code, each]));
const rate = (code: string) => items.get(code)!;

describe('rate card', () => {
  it('works a rate out from its build-up, as the sample BOQ shows', () => {
    expect(rateOf(rate('CEI-01'), prices)).toBe(18562);
    expect(rateOf(rate('CON-01'), prices)).toBe(134568);
    expect(rateOf(rate('CON-03'), prices)).toBe(137290);
  });

  it('prices a WORK line at the other item’s rate (blinding is 0.05 of CON-02)', () => {
    expect(rateOf(rate('CON-15'), prices, items)).toBe(5499);
  });

  it('prices every item in the library', () => {
    expect(rates.filter((each) => rateOf(each, prices, items) == null).map((each) => each.code)).toEqual([]);
  });

  it('moves the rate when a price changes, and blanks it when a price is missing', () => {
    const cheaper = new Map(prices).set('Sharp sand (m³)', { ...prices.get('Sharp sand (m³)')!, price: 0 });
    expect(rateOf(rate('CON-01'), cheaper)).not.toBe(134568);
    const missing = new Map(prices).set('Sharp sand (m³)', { ...prices.get('Sharp sand (m³)')!, price: null });
    expect(rateOf(rate('CON-01'), missing)).toBeNull();
  });

  it('gives no rate to an item built on itself', () => {
    const loop: Rate = { ...rate('CON-15'), code: 'LOOP', lines: [{ kind: 'WORK', qty: 1, rate: 'LOOP' }] };
    expect(lineOf(loop.lines[0], prices, new Map([['LOOP', loop]]), ['LOOP']).amount).toBeNull();
  });

  it('reads the output per gang-day from labour in days', () => {
    expect(outputOf(rate('CON-01'), prices)).toEqual({ perDay: 8, gang: '1 concrete gang labour' });
  });
});
