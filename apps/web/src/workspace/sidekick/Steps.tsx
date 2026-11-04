/** The pieces of a sidekick message: the steps the AI took (each look-up opens to show what it answered), the wave
 * while it works, the answer with its links acting in the workspace, and the copy button. */
import type { Step } from './types';
import { stepText, seconds, pretty } from './stepText';
import { Wave } from './Wave';

/** The steps to an answer: open while it works, so each shows as it comes; folded into one line once answered. A
 * look-up opens to show what it asked and what it got back. */
export function Steps({ steps, working }: { steps: Step[]; working: boolean }) {
  const lookUps = steps.filter((step) => step.tool).length;
  const took = steps.reduce((sum, step) => sum + (step.seconds ?? 0), 0);
  return (
    <details className="worked" key={working ? 'live' : 'done'} open={working}>
      <summary>
        {working ? 'Working' : 'Worked'}: {lookUps} {lookUps === 1 ? 'look-up' : 'look-ups'}
        {took >= 1 && `, ${seconds(took)}`}
      </summary>
      <ol>
        {steps.map((step, number) =>
          step.note ? (
            <li key={number} className="note">
              {step.note}
            </li>
          ) : (
            <li key={number}>
              <details className="lookUp">
                <summary>
                  {stepText(step)}
                  {step.seconds != null && step.seconds >= 1 && <small> · {seconds(step.seconds)}</small>}
                  {step.result == null && working && number === steps.length - 1 && <Wave />}
                </summary>
                {step.args && Object.keys(step.args).length > 0 && <pre>{JSON.stringify(step.args, null, 2)}</pre>}
                <pre>{step.result == null ? (working ? 'Looking it up…' : 'Not kept') : pretty(step.result)}</pre>
              </details>
            </li>
          ),
        )}
      </ol>
    </details>
  );
}
