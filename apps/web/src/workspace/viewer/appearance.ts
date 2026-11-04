import { COLOUR, GLASS, GOLD, HIDDEN_CLASSES, type RGB } from './constants';
import type { Element, Look, ViewerProps } from './types';

export type Appearance = { visible: boolean; xrayed: boolean; color?: RGB; opacity: number };
type Settings = Pick<ViewerProps, 'hidden' | 'view' | 'looks' | 'mode' | 'date' | 'outline' | 'roofOff' | 'glass'>;

/** How one element is drawn: as designed, as an outline, in its confidence colour, or by its state on the 4D player's
 * day (not started: outline or hidden; under way: gold; done: as designed). */
export function appearance(element: Element, look: Look | undefined, settings: Settings): Appearance {
  const { mode, view, date, outline, roofOff, glass } = settings;
  let visible = !HIDDEN_CLASSES.has(element.cls) && !settings.hidden(element) && !(roofOff && /roof/i.test(element.storey));
  let xrayed = false;
  let color: RGB | undefined;
  let opacity = GLASS.has(element.cls) && glass ? 0.4 : 1;
  if (mode === '4d' && date) {
    if (!look?.start) xrayed = !!outline;
    else if (date < look.start) {
      if (outline) xrayed = true;
      else visible = false;
    } else if (date <= look.finish!) color = GOLD;
  } else if (view === 'skeleton') {
    xrayed = true;
  } else if (mode === 'confidence' && view === 'annotated' && settings.looks) {
    // measured work filled in its confidence colour; what is left out (or not decided yet) stays an outline
    if (look?.conf && look.conf !== 'Excluded') {
      color = COLOUR[look.conf];
      if (glass && element.cls !== 'IfcSlab' && element.cls !== 'IfcRoof') opacity = Math.min(opacity, 0.72);
    } else xrayed = true;
  }
  return { visible, xrayed, color, opacity };
}
