import type { Message, Step } from './types';

type Given = { id?: string; text?: string; name?: string; args?: object; seconds?: number; message?: string };

/** The answer being written, after one event from the stream. What it said before looking something up is its plan:
 * a step, not the answer. Look-ups run side by side, so a result finds its own step. */
export function withAnswerEvent(answer: Message, event: string, data: unknown): Message {
  const value = data as Given;
  if (event === 'token') return { ...answer, text: answer.text + value.text };
  if (event === 'tool') {
    return {
      ...answer,
      text: '',
      steps: [
        ...answer.steps,
        ...(answer.text.trim() ? [{ note: answer.text.trim() }] : []),
        { id: value.id, tool: value.name, args: value.args as Step['args'], seconds: value.seconds },
      ],
    };
  }
  if (event === 'result') return { ...answer, steps: answer.steps.map((step) => (step.id === value.id ? { ...step, result: value.text } : step)) };
  if (event === 'error') return { ...answer, text: value.message ?? 'The sidekick failed.' };
  return answer;
}
