/** What the model shows, worked out from the estimate: each element's colour and dates, the marks drawn on it, and
 * which elements are hidden. Pure functions, so the Workspace only wires them up. */
import { num } from '@/lib/format';
import type { Hidden } from './panels/models/types';
import type { Card, Plan, Result, Work } from './state';
import { HEX } from './viewer/constants';
import { type Element, type Look, type Mark, type View } from './viewer/types';

/** Each element's confidence (its type's), and the dates of the activity that builds it; during a run, only the types
 * the AI has decided so far. */
export function looksOf(result: Result | null, plan: Plan | null, live: Work | null): Map<string, Look> | null {
  const map = new Map<string, Look>();
  if (live) {
    for (const [key, gids] of Object.entries(live.catalogue ?? {})) {
      const conf = live.decided[key];
      if (conf) for (const gid of gids) map.set(gid, { conf });
    }
    return map;
  }
  if (!result) return null;
  for (const type of result.types) {
    const conf = type.mapping.decision === 'exclude' ? 'Excluded' : type.mapping.decision === 'unmapped' ? 'Not mapped' : type.mapping.confidence;
    for (const gid of type.gids) map.set(gid, { conf });
  }
  for (const activity of plan?.leaves ?? []) for (const ref of activity.refs) {
    const look = map.get(ref) ?? {};
    if (!look.start || activity.startDate < look.start) look.start = activity.startDate;
    if (!look.finish || activity.finishDate > look.finish) look.finish = activity.finishDate;
    map.set(ref, look);
  }
  return map;
}

type Commented = { on_kind: string; on_ref: string | null };

/** The run's newest decisions numbered, or a dot per BOQ item; and a pin per element with comments. */
export function marksOf(live: Work | null, labels: boolean, result: Result | null, view: View, comments: Commented[]): Mark[] {
  const out: Mark[] = [];
  if (live) {
    if (labels) live.feed.filter((each): each is Card => 'key' in each && each.confidence !== 'Excluded').slice(0, 8)
      .forEach((card, at) => out.push({ key: `card:${card.key}`, gids: card.gids, kind: 'number', color: HEX[card.confidence], text: String(at + 1), label: card.title }));
  } else if (result && view === 'annotated') {
    const items = result.boq.length ? result.boq : result.takeoff_lines;
    for (const item of items) if (item.gids.length) {
      const ref = result.refs[item.code] ?? '';
      out.push({ key: item.code, gids: item.gids, kind: 'dot', color: HEX[item.confidence] ?? HEX.High, label: `${ref} ${item.description} · ${item.qty == null ? '' : num(item.qty)} ${item.unit}`.trim() });
    }
  }
  if (view !== 'skeleton') {
    const on = new Map<string, number>();
    for (const comment of comments) if (comment.on_kind === 'element' && comment.on_ref) on.set(comment.on_ref, (on.get(comment.on_ref) ?? 0) + 1);
    for (const [ref, count] of on) out.push({ key: `pin:${ref}`, gids: [ref], kind: 'pin', color: '#1f3a5f', text: String(count), label: `${count} comment${count > 1 ? 's' : ''}` });
  }
  return out;
}

/** Whether an element is hidden by the Models and Tree panels (its model, its class or its storey). */
export function hiddenTest(hidden: Hidden) {
  const models = new Set(hidden.models), classes = new Set(hidden.classes), storeys = new Set(hidden.storeys);
  return (element: Element) => models.has(element.model) || classes.has(`${element.model}:${element.cls}`) || storeys.has(`${element.model}:${element.storey}`);
}
