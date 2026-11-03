/** The 3D viewer (xeokit): each model's XKT, converted from its IFC on the server. Element ids are
 * `{model id}#{GlobalId}`, as the estimate refers to them, so the takeoff's confidence, the BOQ's items and the
 * programme's dates all reach the same objects.
 *
 * Three views (the bar's segments): Original (the model as designed), Skeleton (every element as an outline) and
 * Annotated (the takeoff on the model: measured elements filled in their confidence colour, the rest as outlines,
 * and a dot per BOQ item that opens its label). Marks are drawn over the canvas and follow the camera. */
import {
  DistanceMeasurementsMouseControl,
  DistanceMeasurementsPlugin,
  NavCubePlugin,
  SectionPlanesPlugin,
  Viewer as XeoViewer,
  XKTLoaderPlugin,
  type Entity,
} from '@xeokit/xeokit-sdk';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Confidence, Model } from './state';

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

export const COLOUR: Record<string, [number, number, number]> = {
  High: [0.29, 0.86, 0.52], Medium: [0.95, 0.69, 0.2], Low: [0.93, 0.45, 0.16], 'Not mapped': [0.78, 0.2, 0.16],
};
export const HEX: Record<string, string> = { High: '#2e9d5b', Medium: '#e0a93a', Low: '#e0712f', Excluded: '#b9bec4', 'Not mapped': '#c0392b' };
const GOLD: [number, number, number] = [0.91, 0.69, 0.24];
const GLASS = new Set(['IfcWindow', 'IfcPlate', 'IfcCurtainWall']);
const GROUND = /site|terrain|topograph|ground surface/i; // left out when fitting the camera: it can dwarf the building
const NEAR = 18; // px: dots this close merge into a count

type Xeo = { viewer: XeoViewer; loader: XKTLoaderPlugin; sections: SectionPlanesPlugin; distances: DistanceMeasurementsPlugin; measure: DistanceMeasurementsMouseControl; elements: Map<string, Element> };

function storeyOf(meta: { type: string; name: string; parent?: unknown } | undefined): string {
  let at = meta as { type: string; name: string; parent?: unknown } | undefined;
  while (at) {
    if (at.type === 'IfcBuildingStorey') return at.name;
    at = at.parent as typeof at;
  }
  return '';
}

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const Viewer = forwardRef<ViewerHandle, ViewerProps>(function Viewer(props, ref) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cube = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const xeo = useRef<Xeo | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [loaded, setLoaded] = useState<string[]>([]);
  const [error, setError] = useState('');

  /** The scene objects an id stands for: itself, or its parts when it has no shape of its own (a stair of flights). */
  const objectsOf = (ids: string[]) => {
    const now = xeo.current;
    if (!now) return [];
    const scene = now.viewer.scene;
    const out: string[] = [];
    for (const id of ids) {
      if (scene.objects[id]) out.push(id);
      else if (now.viewer.metaScene.metaObjects[id]) out.push(...now.viewer.metaScene.getObjectIDsInSubtree(id).filter((part) => scene.objects[part]));
    }
    return out;
  };

  const fitIds = () => {
    const scene = xeo.current!.viewer.scene;
    const all = scene.visibleObjectIds;
    const building = all.filter((id) => !GROUND.test(xeo.current!.elements.get(id)?.name ?? '') && xeo.current!.elements.get(id)?.cls !== 'IfcSite');
    return building.length ? building : all;
  };

  useEffect(() => {
    let viewer: XeoViewer;
    try {
      viewer = new XeoViewer({ canvasElement: canvas.current!, transparent: true, saoEnabled: false } as never);
    } catch {
      // no WebGL (blocked, or no GPU): the workspace works without the 3D view
      setError('The 3D view needs WebGL, which this browser has turned off. Everything else works.');
      return;
    }
    // a three-quarter view from the south-west; fitting the models keeps this direction
    viewer.camera.eye = [-1, 0.8, 1.2];
    viewer.camera.look = [0, 0, 0];
    viewer.camera.up = [0, 1, 0];
    const scene = viewer.scene;
    scene.xrayMaterial.fillAlpha = 0.04;
    scene.xrayMaterial.edgeAlpha = 0.3;
    scene.xrayMaterial.edgeColor = [0.42, 0.47, 0.52];
    scene.selectedMaterial.fillColor = [0.96, 0.58, 0.12];
    scene.selectedMaterial.fillAlpha = 0.55;
    scene.selectedMaterial.edgeColor = [0.85, 0.42, 0.05];
    new NavCubePlugin(viewer, { canvasElement: cube.current!, visible: true, cameraFly: true } as never);
    const sections = new SectionPlanesPlugin(viewer, { overviewVisible: false } as never);
    const distances = new DistanceMeasurementsPlugin(viewer, {} as never);
    const measure = new DistanceMeasurementsMouseControl(distances, {} as never);
    measure.snapping = true;
    const loader = new XKTLoaderPlugin(viewer);
    const control = viewer.cameraControl as unknown as { on: (event: string, run: (hit: never) => void) => void };
    control.on('picked', (hit: { entity?: Entity; worldPos?: number[]; worldNormal?: number[] }) => {
      const now = latest.current;
      if (now.tool === 'cut' && hit.worldPos && hit.worldNormal) {
        sections.createSectionPlane({ pos: hit.worldPos, dir: hit.worldNormal.map((value) => -value) } as never);
        return;
      }
      if (now.tool) return;
      scene.setObjectsSelected(scene.selectedObjectIds, false);
      if (hit.entity) hit.entity.selected = true;
      now.onPick((hit.entity && xeo.current?.elements.get(String(hit.entity.id))) ?? null);
    });
    control.on('pickedNothing', () => {
      if (latest.current.tool) return;
      scene.setObjectsSelected(scene.selectedObjectIds, false);
      latest.current.onPick(null);
    });
    xeo.current = { viewer, loader, sections, distances, measure, elements: new Map() };
    return () => {
      viewer.destroy();
      xeo.current = null;
    };
  }, []);

  // pinching or ctrl+wheel over the model zooms the model, never the page; marks pass the wheel on to the model
  useEffect(() => {
    const here = box.current!;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
      if (event.target !== canvas.current && canvas.current) {
        event.preventDefault();
        canvas.current.dispatchEvent(new WheelEvent('wheel', event));
      }
    };
    const gesture = (event: Event) => event.preventDefault(); // Safari's pinch
    here.addEventListener('wheel', wheel, { passive: false });
    for (const name of ['gesturestart', 'gesturechange', 'gestureend']) here.addEventListener(name, gesture);
    return () => {
      here.removeEventListener('wheel', wheel);
      for (const name of ['gesturestart', 'gesturechange', 'gestureend']) here.removeEventListener(name, gesture);
    };
  }, []);

  // the current, converted models: loaded once each, unloaded when they go
  const ready = props.models.filter((model) => model.state === 'current' && model.status === 'ready');
  const wanted = ready.map((model) => model.id).join(',');
  useEffect(() => {
    const now = xeo.current;
    if (!now) return;
    const scene = now.viewer.scene;
    for (const id of Object.keys(scene.models)) if (!ready.some((model) => model.id === id)) scene.models[id].destroy();
    const fresh = ready.filter((model) => !scene.models[model.id]);
    let left = fresh.length;
    for (const model of fresh) {
      const nudge = model.nudge ?? { x: 0, z: 0, rotate: 0 };
      const loading = now.loader.load({ id: model.id, src: `/api/v1/models/${model.id}/xkt`, edges: true, globalizeObjectIds: true, position: [nudge.x, 0, nudge.z], rotation: [0, nudge.rotate, 0] } as never);
      loading.on('loaded', () => {
        for (const id of Object.keys(scene.objects)) {
          if (!id.startsWith(`${model.id}#`) || now.elements.has(id)) continue;
          const meta = now.viewer.metaScene.metaObjects[id] as { type: string; name: string; parent?: unknown } | undefined;
          now.elements.set(id, { id, model: model.id, cls: meta?.type ?? '', name: meta?.name ?? '', storey: storeyOf(meta) });
          if (meta?.type === 'IfcSpace' || meta?.type === 'IfcOpeningElement') scene.objects[id].visible = false; // room volumes hide the building
        }
        left -= 1;
        if (!left) now.viewer.cameraFlight.jumpTo({ aabb: scene.getAABB(fitIds()) });
        setLoaded((list) => [...list, model.id]);
        latest.current.onElements([...now.elements.values()]);
      });
      loading.on('error', (message: string) => setError(`${model.name}: ${message}`));
    }
  }, [wanted, error]);

  // what each element looks like: as designed, as an outline, its confidence, or its state on the 4D player's day
  useEffect(() => {
    const now = xeo.current;
    if (!now) return;
    const scene = now.viewer.scene;
    const annotated = props.mode === 'confidence' && props.view === 'annotated' && props.looks;
    for (const element of now.elements.values()) {
      const entity = scene.objects[element.id];
      if (!entity) continue;
      const look = props.looks?.get(element.id);
      const space = element.cls === 'IfcSpace' || element.cls === 'IfcOpeningElement';
      let visible = !space && !props.hidden(element) && !(props.roofOff && /roof/i.test(element.storey));
      let xrayed = false;
      let color: [number, number, number] | undefined;
      let opacity = GLASS.has(element.cls) && props.glass ? 0.4 : 1;
      if (props.mode === '4d' && props.date) {
        if (!look?.start) xrayed = !!props.outline;
        else if (props.date < look.start) {
          if (props.outline) xrayed = true;
          else visible = false;
        } else if (props.date <= look.finish!) color = GOLD;
      } else if (props.view === 'skeleton') {
        xrayed = true;
      } else if (annotated) {
        // measured work filled in its confidence colour; what is left out (or not decided yet) stays an outline
        if (look?.conf && look.conf !== 'Excluded') {
          color = COLOUR[look.conf];
          if (props.glass && element.cls !== 'IfcSlab' && element.cls !== 'IfcRoof') opacity = Math.min(opacity, 0.72);
        } else xrayed = true;
      }
      entity.visible = visible;
      entity.xrayed = xrayed;
      entity.colorize = color ?? (null as never);
      entity.opacity = opacity;
    }
  }, [props.hidden, props.looks, props.view, props.mode, props.date, props.outline, props.roofOff, props.glass, loaded]);

  // a model nudged into line with the others
  const nudges = props.models.map((model) => `${model.id}:${model.nudge?.x},${model.nudge?.z},${model.nudge?.rotate}`).join('|');
  useEffect(() => {
    const scene = xeo.current?.viewer.scene;
    if (!scene) return;
    for (const model of props.models) {
      const found = scene.models[model.id] as unknown as { position: number[]; rotation: number[] } | undefined;
      if (found && model.nudge) {
        found.position = [model.nudge.x, 0, model.nudge.z];
        found.rotation = [0, model.nudge.rotate, 0];
      }
    }
  }, [nudges, loaded]);

  useEffect(() => {
    const now = xeo.current;
    if (!now) return;
    if (props.tool === 'measure') now.measure.activate();
    else now.measure.deactivate();
  }, [props.tool]);

  // the marks: each sits on the middle of one of its visible elements and follows the camera; near dots merge
  useEffect(() => {
    const now = xeo.current;
    const here = layer.current;
    if (!now || !here) return;
    const scene = now.viewer.scene;
    const anchors: { mark: Mark; at: number[]; ids: string[] }[] = [];
    for (const mark of props.marks) {
      const ids = objectsOf(mark.gids.slice(0, 200)).filter((id) => scene.objects[id].visible);
      if (!ids.length) continue;
      const aabb = scene.objects[ids[0]].aabb;
      anchors.push({ mark, ids, at: [(aabb[0] + aabb[3]) / 2, (aabb[1] + aabb[4]) / 2, (aabb[2] + aabb[5]) / 2] });
    }
    const draw = () => {
      const width = here.clientWidth, height = here.clientHeight;
      const placed: { x: number; y: number; items: typeof anchors }[] = [];
      for (const anchor of anchors) {
        const [x, y] = (now.viewer.camera as unknown as { projectWorldPos: (at: number[]) => [number, number] }).projectWorldPos(anchor.at);
        if (!(x > 0 && y > 0 && x < width && y < height)) continue;
        const near = anchor.mark.kind === 'dot' && anchor.mark.key !== latest.current.open
          ? placed.find((spot) => spot.items[0].mark.kind === 'dot' && spot.items[0].mark.key !== latest.current.open && Math.hypot(spot.x - x, spot.y - y) < NEAR)
          : undefined;
        if (near) near.items.push(anchor);
        else placed.push({ x, y, items: [anchor] });
      }
      here.innerHTML = placed.map((spot, at) => {
        const style = `left:${spot.x}px;top:${spot.y}px`;
        if (spot.items.length > 1) return `<button class="mk cluster" data-cluster="${at}" style="${style}">${spot.items.length}</button>`;
        const { mark } = spot.items[0];
        const open = mark.key === latest.current.open;
        const label = open && mark.label ? `<span class="mk-label">${escape(mark.label)}</span>` : '';
        return `<button class="mk ${mark.kind}${open ? ' open' : ''}" data-key="${escape(mark.key)}" style="${style};--c:${mark.color}">${mark.text ? escape(mark.text) : ''}${label}</button>`;
      }).join('');
      here.dataset.spots = JSON.stringify(placed.map((spot) => spot.items.flatMap((item) => item.ids.slice(0, 50))));
    };
    const click = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest('button.mk') as HTMLElement | null;
      if (!target) return;
      if (target.dataset.cluster) {
        // a count: zoom in on its dots so they separate
        const ids = JSON.parse(here.dataset.spots ?? '[]')[Number(target.dataset.cluster)] as string[];
        now.viewer.cameraFlight.flyTo({ aabb: scene.getAABB(ids), duration: 0.6 });
      } else if (target.dataset.key) latest.current.onMark(target.dataset.key);
    };
    here.addEventListener('click', click);
    const watch = [now.viewer.camera.on('matrix', draw), now.viewer.camera.on('projMatrix', draw)];
    const resize = new ResizeObserver(draw);
    resize.observe(here);
    draw();
    return () => {
      here.removeEventListener('click', click);
      now.viewer.camera.off(watch[0]);
      now.viewer.camera.off(watch[1]);
      resize.disconnect();
      here.innerHTML = '';
    };
  }, [props.marks, props.open, props.hidden, props.roofOff, loaded]);

  useImperativeHandle(ref, () => ({
    fit: (tight) => xeo.current?.viewer.cameraFlight.flyTo({ aabb: xeo.current.viewer.scene.getAABB(fitIds()), ...(tight ? { fitFOV: 28, duration: 0.6 } : {}) } as never),
    hideSelected: () => xeo.current?.viewer.scene.setObjectsVisible(xeo.current.viewer.scene.selectedObjectIds, false),
    showAll: () => {
      const now = xeo.current;
      if (now) now.viewer.scene.setObjectsVisible([...now.elements.values()].filter((element) => !latest.current.hidden(element) && element.cls !== 'IfcSpace' && element.cls !== 'IfcOpeningElement').map((element) => element.id), true);
    },
    erase: () => {
      xeo.current?.sections.clear();
      xeo.current?.distances.clear();
    },
    select: (ids, fly = true) => {
      const scene = xeo.current?.viewer.scene;
      if (!scene) return;
      scene.setObjectsSelected(scene.selectedObjectIds, false);
      const list = objectsOf(ids == null ? [] : Array.isArray(ids) ? ids : [ids]);
      if (!list.length) return;
      scene.setObjectsSelected(list, true);
      const shown = list.filter((id) => scene.objects[id].visible);
      if (fly && shown.length) xeo.current!.viewer.cameraFlight.flyTo({ aabb: scene.getAABB(shown), duration: 0.6, fitFOV: 35 } as never);
      // its first element opens in Properties (a line or dot of many shows where its first one is in the BOQ)
      latest.current.onPick(xeo.current!.elements.get(shown[0] ?? list[0]) ?? null);
    },
    canvas: () => canvas.current,
  }));

  const converting = props.models.filter((model) => model.state === 'current' && model.status === 'converting');
  return (
    <div ref={box} className="absolute inset-0 touch-none overscroll-none" style={{ background: 'radial-gradient(ellipse at 50% 45%, #fbfbfa 0%, #f1f1ef 100%)' }}>
      <canvas ref={canvas} id="canvas" className="h-full w-full touch-none" style={{ cursor: props.tool ? 'crosshair' : 'default' }} />
      <div ref={layer} className="marks pointer-events-none absolute inset-0 overflow-hidden" />
      <canvas ref={cube} className="absolute bottom-[78px] right-[26px] h-[92px] w-[92px]" />
      {(converting.length > 0 || error || (ready.length > loaded.length && xeo.current)) && (
        <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-white px-3 py-1.5 text-[12.5px] text-[#59636e] shadow-card">
          {error || (converting.length ? `Converting ${converting.map((model) => model.name).join(', ')}…` : 'Loading the models…')}
        </p>
      )}
      {props.models.length === 0 && <p className="absolute inset-0 grid place-items-center text-[14px] text-[#6b7581]">No models yet: use Import IFC to add the building's models.</p>}
    </div>
  );
});
