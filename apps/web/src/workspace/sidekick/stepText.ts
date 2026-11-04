import type { Step } from './types';

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
export function stepText(step: Step): string {
  if (step.note) return step.note;
  const args = Object.values(step.args ?? {}).filter((value) => value !== '' && value !== null);
  const name = STEP_NAMES[step.tool ?? ''] ?? step.tool;
  if (step.tool?.startsWith('ask_')) return `Asked the ${step.tool.slice(4)} specialist: ${step.args?.task ?? ''}`;
  return `Looked up ${name}${args.length ? ` (${args.join(', ')})` : ''}`;
}

export const seconds = (value: number) =>
  value >= 60 ? `${Math.floor(value / 60)} min ${Math.round(value % 60)} s` : `${Math.round(value)} s`;

/** A look-up's answer as the AI got it: JSON laid out, anything else as it came. */
export function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
