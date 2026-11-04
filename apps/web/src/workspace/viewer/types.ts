import type { DistanceMeasurementsMouseControl, DistanceMeasurementsPlugin, SectionPlanesPlugin, Viewer as XeoViewer, XKTLoaderPlugin } from '@xeokit/xeokit-sdk';
import type { Confidence, Model } from '../state';

export type Element = { id: string; model: string; cls: string; name: string; storey: string };
/** How an element is drawn: its confidence (takeoff), or the dates of the activity that builds it (4D). */
export type Look = { conf?: Confidence | 'Excluded' | 'Not mapped'; start?: string; finish?: string };
export type View = 'original' | 'skeleton' | 'annotated';
/** Something drawn on the model: a BOQ item's dot, a numbered label from the run's feed, or a comment pin. */
export type Mark = { key: string; gids: string[]; kind: 'dot' | 'number' | 'pin'; color: string; text?: string; label?: string };

export type ViewerHandle = {
  fit: (tight?: boolean) => void; // tight: the building fills the view (the 4D recording)
  hideSelected: () => void;
  showAll: () => void;
  erase: () => void;
  select: (ids: string[] | string | null, fly?: boolean) => void;
  canvas: () => HTMLCanvasElement | null;
};

export type ViewerProps = {
  models: Model[];
  hidden: (element: Element) => boolean; // the Models and Tree panels' tick boxes
  view: View;
  looks: Map<string, Look> | null;
  mode: 'confidence' | '4d';
  date?: string; // the 4D player's day
  outline?: boolean; // not started shown as outline
  roofOff?: boolean;
  glass: boolean; // see-through glass
  tool: 'cut' | 'measure' | null;
  marks: Mark[];
  open: string | null; // the mark whose label is open
  onMark: (key: string) => void;
  onPick: (element: Element | null) => void;
  onElements: (elements: Element[]) => void; // what the loaded models hold, for the Tree panel
};

export type Xeo = { viewer: XeoViewer; loader: XKTLoaderPlugin; sections: SectionPlanesPlugin; distances: DistanceMeasurementsPlugin; measure: DistanceMeasurementsMouseControl; elements: Map<string, Element> };
