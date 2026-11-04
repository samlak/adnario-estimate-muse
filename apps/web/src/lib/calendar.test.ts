import { describe, expect, it } from 'vitest';
import { isWorking, parse, weekOf, workingDays } from './calendar';

describe('calendar', () => {
  it('counts the Lekki programme’s working days, as its Gantt shows', () => {
    const days = workingDays(parse('2026-12-01'), parse('2027-09-13'));
    expect(days.length).toBe(239);
    expect(days.findIndex((day) => +day === +parse('2027-05-12')) + 1).toBe(134);
    expect(weekOf(parse('2026-12-01'), parse('2027-05-12'))).toBe(24);
  });

  it('takes Christmas, Boxing Day, New Year and Easter off', () => {
    expect(workingDays(parse('2026-12-18'), parse('2027-01-25')).length).toBe(30);
    expect(isWorking(parse('2027-03-26'))).toBe(false); // Good Friday
    expect(isWorking(parse('2027-03-29'))).toBe(false); // Easter Monday
    expect(isWorking(parse('2027-03-27'))).toBe(true); // Saturday is worked
  });

  it('takes the days the QS adds by hand off too (Eid moves with the moon)', () => {
    const eid = parse('2027-03-10');
    expect(isWorking(eid)).toBe(true);
    expect(isWorking(eid, ['2027-2-10'])).toBe(false);
  });
});
