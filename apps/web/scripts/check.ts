/** The rate and calendar arithmetic, checked against the numbers the screenshots show. Run: npm run check */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, weekOf, workingDays } from '@/lib/calendar';
import { outputOf, rateOf, type Price, type Rate } from '@/lib/ratecard';

const card = (name: string) => JSON.parse(readFileSync(new URL(`../../../overview/rate-card/${name}`, import.meta.url), 'utf8'));
const prices = new Map<string, Price>((card('prices.json') as Price[]).map((each) => [each.name, each]));
const rates = card('rates.json') as Rate[];
const rate = (code: string) => rates.find((each) => each.code === code)!;
assert.equal(rateOf(rate('CEI-01'), prices), 18562);
assert.equal(rateOf(rate('CON-01'), prices), 134568);
assert.equal(rateOf(rate('CON-03'), prices), 137290);
// a WORK line: a quantity of another item at its rate (blinding is 0.05 of CON-02), as the sample BOQ prices it
const items = new Map((card('rates.json') as Rate[]).map((each) => [each.code, each]));
assert.equal(rateOf(rate('CON-15'), prices, items), 5499);
assert.ok((card('rates.json') as Rate[]).every((each) => rateOf(each, prices, items) != null), 'every rate is priced');
assert.deepEqual(outputOf(rate('CON-01'), prices), { perDay: 8, gang: '1 concrete gang labour' });
const cheaper = new Map(prices);
cheaper.set('Sharp sand (m³)', { ...prices.get('Sharp sand (m³)')!, price: 0 });
assert.notEqual(rateOf(rate('CON-01'), cheaper), 134568, 'a price change moves the rate');

const days = workingDays(parse('2026-12-01'), parse('2027-09-13'));
assert.equal(days.length, 239);
assert.equal(days.findIndex((day) => +day === +parse('2027-05-12')) + 1, 134);
assert.equal(weekOf(parse('2026-12-01'), parse('2027-05-12')), 24);
assert.equal(workingDays(parse('2026-12-18'), parse('2027-01-25')).length, 30); // Christmas, Boxing Day, New Year off
console.log('check: all good');
