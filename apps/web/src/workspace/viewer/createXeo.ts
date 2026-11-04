import {
  DistanceMeasurementsMouseControl,
  DistanceMeasurementsPlugin,
  NavCubePlugin,
  SectionPlanesPlugin,
  Viewer as XeoViewer,
  XKTLoaderPlugin,
  type Entity,
} from '@xeokit/xeokit-sdk';
import type { MutableRefObject } from 'react';
import type { ViewerProps, Xeo } from './types';

/** The xeokit viewer on the canvas, with the nav cube, section planes, measuring and the XKT loader; a click picks an
 * element, or cuts a section with the cut tool. Throws without WebGL. */
export function createXeo(canvas: HTMLCanvasElement, cube: HTMLCanvasElement, latest: MutableRefObject<ViewerProps>, current: () => Xeo | null): Xeo {
  const viewer = new XeoViewer({ canvasElement: canvas, transparent: true, saoEnabled: false } as never);
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
  new NavCubePlugin(viewer, { canvasElement: cube, visible: true, cameraFly: true } as never);
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
    now.onPick((hit.entity && current()?.elements.get(String(hit.entity.id))) ?? null);
  });
  control.on('pickedNothing', () => {
    if (latest.current.tool) return;
    scene.setObjectsSelected(scene.selectedObjectIds, false);
    latest.current.onPick(null);
  });
  return { viewer, loader, sections, distances, measure, elements: new Map() };
}
