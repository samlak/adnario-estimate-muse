/** The workspace's shared state: the project, its models and estimate from the API, which panel is open, the 4D
 * player's day, what is selected, and the long work running on the server (README §7). */
import { createContext, useContext } from 'react';
import { parse } from '@/lib/calendar';

export type Panel = 'models' | 'tree' | 'takeoff' | 'cost' | 'programme' | 'cashflow';
/** The panels that show the estimate's data, and can open full width. */
export const DATA_PANELS: Panel[] = ['takeoff', 'cost', 'programme', 'cashflow'];
export type Confidence = 'High' | 'Medium' | 'Low';

// ── What the API answers ─────────────────────────────────────────────────────────────────────────────────────────
export type Project = { id: string; name: string; client: string; location: string; description: string; access: 'edit' | 'view'; editor: boolean };
export type Model = {
  id: string; name: string; version: number; state: 'current' | 'proposed' | 'rejected' | 'superseded'; size: number;
  status: 'converting' | 'ready' | 'failed'; note: string | null; seconds: number | null; stats: { elements?: number; glass?: number };
  nudge: { x: number; z: number; rotate: number }; changes?: { added: number; removed: number; changed: number }; created_at: string;
};
export type Mapping = { decision: 'bill' | 'exclude' | 'unmapped'; held: boolean; reason: string; confidence: Confidence; items: { description: string; section: string; unit: string; method: string }[] };
export type Type = { key: string; model: string; class: string; family: string | null; type: string; size: string | null; count: number; gids: string[]; mapping: Mapping };
export type Line = { code: string; section: string; bill: string; description: string; unit: string; qty: number | null; count: number; gids: string[]; confidence: Confidence };
export type Item = Line & { rate: number | null; rate_item_id: string | null; rate_note: string | null; source: 'group' | 'provisional' | 'qs'; lines: string[] };
export type Provisional = { code: string; description: string; section: string; bill: string; unit: string; qty: number | null; basis: string; reason: string };
export type Totals = { bills: Record<string, { name: string; total: number; sections: Record<string, number> }>; measured: number; prelims: number; contingency: number; vat: number; total: number; unpriced: number; priced: number };
export type Result = {
  run: { name: string; seconds: number }; brief: string; context: string; review_summary: string; models: { id: string; name: string }[];
  types: Type[]; takeoff: { ref: string; storey: string | null; type_key: string; status: string; qty: number; unit: string; code?: string; source?: string; description: string }[];
  takeoff_lines: Line[]; boq: Item[]; questions: { severity: 'high' | 'medium' | 'low'; question: string; line_codes: string[] }[];
  provisional: Provisional[]; pricing: { prelims: number; contingency: number; vat: number; rate_card?: { id: string; title: string } | null; sources: Record<string, { card: string; code: string; description: string }> };
  refs: Record<string, string>; totals: Totals | null;
};
export type ApiActivity = { id: number; code: string; name: string; summary: boolean; level: number; start: number; finish: number; milestone: boolean; float: number; critical: boolean; cost: number | null; work: { code: string; description: string; qty: number | null; unit: string; shared: boolean }[]; refs: string[] };
export type ApiProgramme = {
  title: string; start: string; days: string[]; end: number; activities: ApiActivity[]; links: { before: number; after: number }[];
  cash_flow: { month: string; work: number; prelims: number; contingency: number; vat: number; total: number; cumulative: number; activities: { id: number; days: number; amount: number }[] }[];
  unpriced: string[]; not_in_programme: { section: string; storey: string; operation: string; count: number }[];
};
export type Estimate = { id: string; revision: number; name: string; status: 'new' | 'running' | 'ready' | 'failed'; info: { text?: string; documents?: string[] }; undo: number; redo: number; running: string[]; result: Result | null; programme: ApiProgramme | null };

// ── The programme as the panels draw it ──────────────────────────────────────────────────────────────────────────
export type Activity = ApiActivity & { startDate: string; finishDate: string; days: number; follows: number[] };
export type Plan = { start: Date; finish: Date; days: Date[]; dayIso: string[]; activities: Activity[]; leaves: Activity[]; months: ApiProgramme['cash_flow']; byId: Map<number, Activity> };

export function planOf(programme: ApiProgramme | null): Plan | null {
  if (!programme || !programme.days.length) return null;
  const dayIso = programme.days;
  const follows = new Map<number, number[]>();
  for (const link of programme.links) follows.set(link.after, [...(follows.get(link.after) ?? []), link.before]);
  const activities = programme.activities.map((activity) => {
    // a summary spans what is under it
    const last = Math.min(dayIso.length - 1, Math.max(activity.start, activity.finish - 1));
    return { ...activity, startDate: dayIso[Math.min(activity.start, dayIso.length - 1)], finishDate: dayIso[last], days: activity.finish - activity.start, follows: follows.get(activity.id) ?? [] };
  });
  return {
    start: parse(programme.start), finish: parse(dayIso[dayIso.length - 1]), days: dayIso.map(parse), dayIso, activities,
    leaves: activities.filter((activity) => !activity.summary), months: programme.cash_flow, byId: new Map(activities.map((each) => [each.id, each])),
  };
}

export const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const weekOf = (plan: Plan, day: number) => Math.floor((plan.days[day].getTime() - plan.start.getTime()) / 86400000 / 7) + 1;
/** The first working day of week N. */
export const dayOfWeek = (plan: Plan, week: number) => Math.max(0, plan.days.findIndex((date) => Math.floor((date.getTime() - plan.start.getTime()) / 86400000 / 7) + 1 >= week));

/** A type the AI has decided, as the run's live feed shows it. */
export type Card = { key: string; title: string; detail: string; qty: string; confidence: Confidence | 'Excluded' | 'Not mapped'; gids: string[] };
/** Long work on the server, as it streams: its stages, how far it got, and (a run) what it has decided so far. */
export type Work = {
  kind: 'run' | 'boq' | 'link' | 'programme'; stages: { name: string; state: string; seconds?: number; [more: string]: unknown }[]; error?: string; done: boolean; mapped: number;
  started: number; feed: ({ text: string } | Card)[]; seen?: string; catalogue?: Record<string, string[]>; decided: Record<string, Card['confidence']>; file?: string;
};

export type Ws = {
  project: Project;
  projectId: string;
  projectName: string;
  models: Model[];
  estimate: Estimate | undefined;
  result: Result | null;
  plan: Plan | null;
  money: boolean;
  editor: boolean;
  seeRates: boolean;
  panel: Panel | null;
  open: (panel: Panel | null) => void;
  full: boolean;
  setFull: (full: boolean) => void;
  day: number;
  setDay: (day: number) => void;
  boqTab: string;
  setBoqTab: (tab: string) => void;
  line: string | null;
  setLine: (code: string | null) => void;
  activity: number | null;
  setActivity: (id: number | null) => void;
  show: (refs: string[], fly?: boolean) => void; // select these elements in 3D (and fly to them)
  view: 'original' | 'skeleton' | 'annotated';
  setView: (view: 'original' | 'skeleton' | 'annotated') => void;
  labels: boolean; // the run's feed labels the model
  setLabels: (on: boolean) => void;
  edit: (change: Record<string, unknown>) => Promise<void>;
  undo: (() => void) | null;
  redo: (() => void) | null;
  work: Work | null;
  start: (kind: Work['kind'], body?: FormData) => void;
  refresh: () => void;
};

export const WsContext = createContext<Ws | null>(null);
export const useWs = () => useContext(WsContext)!;
