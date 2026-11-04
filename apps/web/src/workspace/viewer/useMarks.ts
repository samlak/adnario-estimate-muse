import { useEffect, type MutableRefObject, type RefObject } from 'react';
import { marksHtml, place, type Anchor } from './marks';
import { objectsOf } from './scene';
import type { ViewerProps, Xeo } from './types';

/** The marks over the canvas: each sits on the middle of one of its visible elements and follows the camera; a count
 * zooms in on its dots so they separate; a mark tells the workspace it was pressed. */
export function useMarks(xeo: MutableRefObject<Xeo | null>, layer: RefObject<HTMLDivElement>, latest: MutableRefObject<ViewerProps>, props: ViewerProps, loaded: string[]) {
  useEffect(() => {
    const now = xeo.current;
    const here = layer.current;
    if (!now || !here) return;
    const scene = now.viewer.scene;
    const anchors: Anchor[] = [];
    for (const mark of props.marks) {
      const ids = objectsOf(now, mark.gids.slice(0, 200)).filter((id) => scene.objects[id].visible);
      if (!ids.length) continue;
      const aabb = scene.objects[ids[0]].aabb;
      anchors.push({ mark, ids, at: [(aabb[0] + aabb[3]) / 2, (aabb[1] + aabb[4]) / 2, (aabb[2] + aabb[5]) / 2] });
    }
    const project = (at: number[]) => (now.viewer.camera as unknown as { projectWorldPos: (at: number[]) => [number, number] }).projectWorldPos(at);
    const draw = () => {
      const placed = place(anchors, project, here.clientWidth, here.clientHeight, latest.current.open);
      here.innerHTML = marksHtml(placed, latest.current.open);
      here.dataset.spots = JSON.stringify(placed.map((spot) => spot.items.flatMap((item) => item.ids.slice(0, 50))));
    };
    const click = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest('button.mk') as HTMLElement | null;
      if (!target) return;
      if (target.dataset.cluster) {
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
}
