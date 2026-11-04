/** The 3D viewer (xeokit): each model's XKT, converted from its IFC on the server. Element ids are
 * `{model id}#{GlobalId}`, as the estimate refers to them, so the takeoff's confidence, the BOQ's items and the
 * programme's dates all reach the same objects.
 *
 * Three views (the bar's segments): Original (the model as designed), Skeleton (every element as an outline) and
 * Annotated (the takeoff on the model: measured elements filled in their confidence colour, the rest as outlines,
 * and a dot per BOQ item that opens its label). Marks are drawn over the canvas and follow the camera. */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { appearance } from './appearance';
import { HIDDEN_CLASSES } from './constants';
import { createXeo } from './createXeo';
import { fitIds, objectsOf, storeyOf } from './scene';
import type { ViewerHandle, ViewerProps, Xeo } from './types';
import { useMarks } from './useMarks';
import { useWheelToModel } from './useWheelToModel';
import { ViewerNotice } from './ViewerNotice';

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

  useEffect(() => {
    try {
      xeo.current = createXeo(canvas.current!, cube.current!, latest, () => xeo.current);
    } catch {
      // no WebGL (blocked, or no GPU): the workspace works without the 3D view
      setError('The 3D view needs WebGL, which this browser has turned off. Everything else works.');
      return;
    }
    return () => {
      xeo.current?.viewer.destroy();
      xeo.current = null;
    };
  }, []);

  useWheelToModel(box, canvas);

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
          if (HIDDEN_CLASSES.has(meta?.type ?? '')) scene.objects[id].visible = false;
        }
        left -= 1;
        if (!left) now.viewer.cameraFlight.jumpTo({ aabb: scene.getAABB(fitIds(now)) });
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
    for (const element of now.elements.values()) {
      const entity = scene.objects[element.id];
      if (!entity) continue;
      const { visible, xrayed, color, opacity } = appearance(element, props.looks?.get(element.id), props);
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

  useMarks(xeo, layer, latest, props, loaded);

  useImperativeHandle(ref, () => ({
    fit: (tight) => xeo.current?.viewer.cameraFlight.flyTo({ aabb: xeo.current.viewer.scene.getAABB(fitIds(xeo.current)), ...(tight ? { fitFOV: 28, duration: 0.6 } : {}) } as never),
    hideSelected: () => xeo.current?.viewer.scene.setObjectsVisible(xeo.current.viewer.scene.selectedObjectIds, false),
    showAll: () => {
      const now = xeo.current;
      if (now) now.viewer.scene.setObjectsVisible([...now.elements.values()].filter((element) => !latest.current.hidden(element) && !HIDDEN_CLASSES.has(element.cls)).map((element) => element.id), true);
    },
    erase: () => {
      xeo.current?.sections.clear();
      xeo.current?.distances.clear();
    },
    select: (ids, fly = true) => {
      const scene = xeo.current?.viewer.scene;
      if (!scene) return;
      scene.setObjectsSelected(scene.selectedObjectIds, false);
      const list = objectsOf(xeo.current, ids == null ? [] : Array.isArray(ids) ? ids : [ids]);
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
  const notice = error || (converting.length ? `Converting ${converting.map((model) => model.name).join(', ')}…` : ready.length > loaded.length && xeo.current ? 'Loading the models…' : null);
  return (
    <div ref={box} className="absolute inset-0 touch-none overscroll-none" style={{ background: 'radial-gradient(ellipse at 50% 45%, #fbfbfa 0%, #f1f1ef 100%)' }}>
      <canvas ref={canvas} id="canvas" className="h-full w-full touch-none" style={{ cursor: props.tool ? 'crosshair' : 'default' }} />
      <div ref={layer} className="marks pointer-events-none absolute inset-0 overflow-hidden" />
      <canvas ref={cube} className="absolute bottom-[78px] right-[26px] h-[92px] w-[92px]" />
      <ViewerNotice text={notice} empty={props.models.length === 0} />
    </div>
  );
});
