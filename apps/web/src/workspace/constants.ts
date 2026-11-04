import { Banknote, Boxes, CalendarDays, LineChart, ListTree, Ruler } from 'lucide-react';
import type { Panel } from './state';

/** Each side panel's width when it is not full view. */
export const WIDTH: Record<Panel, number> = { models: 285, tree: 313, takeoff: 475, cost: 360, programme: 405, cashflow: 447 };

/** Dragging a panel's edge: under `close` pixels it shuts and the model has the room; otherwise it is kept between
 * `min` and the `max` share of the window. */
export const DRAG = { close: 140, min: 240, max: 0.7 };
/** The same for the programme's dock under the model, in pixels high; `model` is what is always left above it. */
export const DOCK_DRAG = { close: 100, min: 160, model: 200 };

/** The rail down the left; a panel with money is hidden from who may not see it. */
export const RAIL: { id: Panel; icon: typeof Boxes; label: string; money?: boolean }[] = [
  { id: 'models', icon: Boxes, label: 'Models' },
  { id: 'tree', icon: ListTree, label: 'Tree' },
  { id: 'takeoff', icon: Ruler, label: 'Takeoff', money: true },
  { id: 'cost', icon: Banknote, label: 'Cost', money: true },
  { id: 'programme', icon: CalendarDays, label: 'Programme' },
  { id: 'cashflow', icon: LineChart, label: 'Cash flow', money: true },
];
