import { describe, expect, it } from 'vitest';
import { can } from '@/lib/store';
import { programme } from '@/testing/data';
import { dayOfWeek, iso, planOf, weekOf } from './state';

describe('the programme as the panels draw it', () => {
  it('is nothing without a programme', () => {
    expect(planOf(null)).toBeNull();
    expect(planOf({ ...programme, days: [] })).toBeNull();
  });

  it('dates each activity, its finish the last day it works', () => {
    const plan = planOf(programme)!;
    const set = plan.byId.get(3)!;
    expect([set.startDate, set.finishDate, set.days, set.follows]).toEqual(['2026-12-03', '2026-12-09', 3, [2]]);
    expect(plan.byId.get(4)!.startDate).toBe('2026-12-09'); // a milestone past the end sits on the last day
    expect(plan.leaves.map((each) => each.id)).toEqual([2, 3, 4]);
    expect(iso(plan.finish)).toBe('2026-12-09');
  });

  it('counts weeks from the start', () => {
    const plan = planOf(programme)!;
    expect(weekOf(plan, 2)).toBe(1);
    expect(weekOf(plan, 3)).toBe(2);
    expect(dayOfWeek(plan, 2)).toBe(3);
  });
});

describe('roles', () => {
  it('hides money from contributors and rate cards from viewers', () => {
    expect(can('contributor').seeMoney).toBe(false);
    expect(can('viewer')).toEqual({ seeMoney: true, seeRateCards: false, editEstimate: false, manageOrg: false });
    expect(can('admin').manageOrg).toBe(true);
    expect(can('qs').manageOrg).toBe(false);
  });
});
