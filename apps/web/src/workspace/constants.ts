import { Banknote, Boxes, CalendarDays, LineChart, ListTree, Ruler } from 'lucide-react';
import type { Panel } from './state';

/** Each side panel's width when it is not full view. */
export const WIDTH: Record<Panel, number> = { models: 285, tree: 313, takeoff: 475, cost: 360, programme: 405, cashflow: 447 };

/** The rail down the left; a panel with money is hidden from who may not see it. */
export const RAIL: { id: Panel; icon: typeof Boxes; label: string; money?: boolean }[] = [
  { id: 'models', icon: Boxes, label: 'Models' },
  { id: 'tree', icon: ListTree, label: 'Tree' },
  { id: 'takeoff', icon: Ruler, label: 'Takeoff', money: true },
  { id: 'cost', icon: Banknote, label: 'Cost', money: true },
  { id: 'programme', icon: CalendarDays, label: 'Programme' },
  { id: 'cashflow', icon: LineChart, label: 'Cash flow', money: true },
];
