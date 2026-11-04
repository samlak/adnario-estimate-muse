import { describe, expect, it } from 'vitest';
import { withAnswerEvent } from './answerEvents';
import type { Message } from './types';

const empty: Message = { role: 'assistant', text: '', steps: [] };

describe('an answer as it streams', () => {
  it('adds tokens to the text', () => {
    const answer = ['The ', 'total'].reduce((now, text) => withAnswerEvent(now, 'token', { text }), empty);
    expect(answer.text).toBe('The total');
  });

  it('turns what it said before a look-up into a step', () => {
    let answer = withAnswerEvent(empty, 'token', { text: 'Let me check. ' });
    answer = withAnswerEvent(answer, 'tool', { id: '1', name: 'boq_totals', args: {} });
    expect(answer.text).toBe('');
    expect(answer.steps).toEqual([{ note: 'Let me check.' }, { id: '1', tool: 'boq_totals', args: {}, seconds: undefined }]);
  });

  it('gives a result to its own step', () => {
    let answer = withAnswerEvent(empty, 'tool', { id: '1', name: 'a' });
    answer = withAnswerEvent(answer, 'tool', { id: '2', name: 'b' });
    answer = withAnswerEvent(answer, 'result', { id: '2', text: '{}' });
    expect(answer.steps.map((step) => step.result)).toEqual([undefined, '{}']);
  });

  it('shows an error as the answer', () => {
    expect(withAnswerEvent(empty, 'error', {}).text).toBe('The sidekick failed.');
    expect(withAnswerEvent(empty, 'error', { message: 'No' }).text).toBe('No');
  });
});
