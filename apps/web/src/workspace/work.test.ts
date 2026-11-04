import { describe, expect, it } from 'vitest';
import type { Card } from './state';
import { newWork, withEvent } from './work';

const card = (key: string, confidence: string) => ({ key, confidence }) as unknown as Card;

describe('long work', () => {
  it('starts empty and names an uploaded file', () => {
    const body = new FormData();
    body.append('file', new File(['x'], 'plan.xlsx'));
    const work = newWork('programme', body);
    expect(work).toMatchObject({ kind: 'programme', stages: [], done: false, mapped: 0, file: 'plan.xlsx' });
    expect(newWork('run').file).toBeUndefined();
  });

  it('replaces a stage of the same name', () => {
    let work = withEvent(newWork('run'), 'stage', { name: 'read', state: 'running' });
    work = withEvent(work, 'stage', { name: 'read', state: 'done' });
    expect(work.stages).toEqual([{ name: 'read', state: 'done' }]);
  });

  it('counts each mapped type once, newest cards first', () => {
    let work = withEvent(newWork('run'), 'mapped', { cards: [card('a', 'high'), card('b', 'low')] });
    work = withEvent(work, 'mapped', { cards: [card('a', 'medium')], confidence: { c: 'high' } });
    expect(work.mapped).toBe(3);
    expect(work.decided).toEqual({ a: 'medium', b: 'low', c: 'high' });
    expect(work.feed.map((each) => ('key' in each ? each.key : ''))).toEqual(['a', 'b', 'a']);
  });

  it('ends on a result, an error or a stop', () => {
    expect(withEvent(newWork('run'), 'result', {}).done).toBe(true);
    expect(withEvent(newWork('run'), 'error', { message: 'boom' })).toMatchObject({ done: true, error: 'boom' });
    expect(withEvent(newWork('run'), 'stopped', {})).toMatchObject({ done: true, error: 'Stopped' });
  });

  it('keeps logs and what it saw, and ignores what it does not know', () => {
    let work = withEvent(newWork('run'), 'log', { text: 'hello' });
    work = withEvent(work, 'seen', { text: 'drawings' });
    expect(work.feed[0]).toEqual({ text: 'hello' });
    expect(work.seen).toBe('drawings');
    expect(withEvent(work, 'nonsense', {})).toBe(work);
  });
});
