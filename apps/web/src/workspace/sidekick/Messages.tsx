/** The pieces of a sidekick message: the steps the AI took (each look-up opens to show what it answered), the wave
 * while it works, the answer with its links acting in the workspace, and the copy button. */
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import type { SidekickLinks, Step } from './types';
import { Markdown } from './Markdown';

const STEP_NAMES: Record<string, string> = {
  project_info: 'the project',
  model_overview: 'the model',
  query_elements: 'elements',
  element_details: 'an element',
  takeoff_summary: 'the takeoff',
  not_measured: 'what is not measured',
  boq_lines: 'BOQ items',
  boq_line: 'a BOQ item',
  boq_totals: 'BOQ totals',
  review_questions: 'the review questions',
  provisional_items: 'the provisional items',
  programme_overview: 'the programme overview',
  activity: 'an activity',
  programme_at: 'the programme',
  programme_activities: 'programme activities',
  cash_flow: 'the cash flow',
};
/** A step in words: "Looked up the programme (week 3)", or what the AI said it would check. */
function stepText(step: Step): string {
  if (step.note) return step.note;
  const args = Object.values(step.args ?? {}).filter((value) => value !== '' && value !== null);
  const name = STEP_NAMES[step.tool ?? ''] ?? step.tool;
  if (step.tool?.startsWith('ask_')) return `Asked the ${step.tool.slice(4)} specialist: ${step.args?.task ?? ''}`;
  return `Looked up ${name}${args.length ? ` (${args.join(', ')})` : ''}`;
}
export const seconds = (value: number) =>
  value >= 60 ? `${Math.floor(value / 60)} min ${Math.round(value % 60)} s` : `${Math.round(value)} s`;

/** A look-up's answer as the AI got it: JSON laid out, anything else as it came. */
function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

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

/** Three dots in a wave: the AI is working. */
export function Wave() {
  return (
    <span className="wave" aria-label="Working">
      <i />
      <i />
      <i />
    </span>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ico copy"
      title="Copy"
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      {copied ? <Check /> : <Copy />}
    </button>
  );
}

const LINK = /^(element|week|boq|activity|panel):(.+)$/;

/** An answer: markdown, with its links [label](element:REF | week:N | boq:CODE | activity:ID | panel:NAME) as buttons. */
export function Answer({ text, links }: { text: string; links: SidekickLinks }) {
  const act = (href: string, label?: string) => {
    const link = LINK.exec(href);
    if (!link) return undefined;
    const [, kind, value] = link;
    return {
      element: () => links.element(value, label ?? value),
      week: () => links.week(Number(value)),
      boq: () => links.line(value),
      activity: () => links.activity(value),
      panel: () => links.panel(value),
    }[kind as 'element' | 'week' | 'boq' | 'activity' | 'panel'];
  };
  return <Markdown text={text} links={act} />;
}
