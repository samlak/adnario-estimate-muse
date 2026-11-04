import { describe, expect, it } from 'vitest';
import { pretty, seconds, stepText } from './stepText';

describe('steps in words', () => {
  it('names a look-up and its arguments', () => {
    expect(stepText({ tool: 'programme_at', args: { week: 3, level: '' } })).toBe('Looked up the programme (3)');
    expect(stepText({ tool: 'boq_totals' })).toBe('Looked up BOQ totals');
    expect(stepText({ tool: 'mystery' })).toBe('Looked up mystery');
  });

  it('says what a specialist was asked, and a note as it is', () => {
    expect(stepText({ tool: 'ask_cost', args: { task: 'sum it' } })).toBe('Asked the cost specialist: sum it');
    expect(stepText({ note: 'Thinking' })).toBe('Thinking');
  });

  it('times in seconds or minutes', () => {
    expect(seconds(4.4)).toBe('4 s');
    expect(seconds(75)).toBe('1 min 15 s');
  });

  it('lays out JSON and leaves the rest', () => {
    expect(pretty('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(pretty('not json')).toBe('not json');
  });
});
