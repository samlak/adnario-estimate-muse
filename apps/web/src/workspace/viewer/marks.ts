import { NEAR } from './constants';
import type { Mark } from './types';

export type Anchor = { mark: Mark; at: number[]; ids: string[] };
export type Spot = { x: number; y: number; items: Anchor[] };

/** The marks on screen: those inside the view, a dot within NEAR px of another merged into one count (never the
 * open one, whose label shows). */
export function place(anchors: Anchor[], project: (at: number[]) => [number, number], width: number, height: number, open: string | null): Spot[] {
  const placed: Spot[] = [];
  for (const anchor of anchors) {
    const [x, y] = project(anchor.at);
    if (!(x > 0 && y > 0 && x < width && y < height)) continue;
    const near = anchor.mark.kind === 'dot' && anchor.mark.key !== open
      ? placed.find((spot) => spot.items[0].mark.kind === 'dot' && spot.items[0].mark.key !== open && Math.hypot(spot.x - x, spot.y - y) < NEAR)
      : undefined;
    if (near) near.items.push(anchor);
    else placed.push({ x, y, items: [anchor] });
  }
  return placed;
}

export const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The marks as buttons over the canvas: a count, or a mark with its text and (when open) its label. */
export function marksHtml(placed: Spot[], open: string | null): string {
  return placed.map((spot, at) => {
    const style = `left:${spot.x}px;top:${spot.y}px`;
    if (spot.items.length > 1) return `<button class="mk cluster" data-cluster="${at}" style="${style}">${spot.items.length}</button>`;
    const { mark } = spot.items[0];
    const isOpen = mark.key === open;
    const label = isOpen && mark.label ? `<span class="mk-label">${escape(mark.label)}</span>` : '';
    return `<button class="mk ${mark.kind}${isOpen ? ' open' : ''}" data-key="${escape(mark.key)}" style="${style};--c:${mark.color}">${mark.text ? escape(mark.text) : ''}${label}</button>`;
  }).join('');
}
