/** Questions about the loaded scene: an element's storey, the objects an id stands for, and what to fit the camera to. */
import { GROUND } from './constants';
import type { Xeo } from './types';

type Meta = { type: string; name: string; parent?: unknown } | undefined;

export function storeyOf(meta: Meta): string {
  let at = meta;
  while (at) {
    if (at.type === 'IfcBuildingStorey') return at.name;
    at = at.parent as Meta;
  }
  return '';
}

/** The scene objects an id stands for: itself, or its parts when it has no shape of its own (a stair of flights). */
export function objectsOf(now: Xeo | null, ids: string[]): string[] {
  if (!now) return [];
  const scene = now.viewer.scene;
  const out: string[] = [];
  for (const id of ids) {
    if (scene.objects[id]) out.push(id);
    else if (now.viewer.metaScene.metaObjects[id]) out.push(...now.viewer.metaScene.getObjectIDsInSubtree(id).filter((part) => scene.objects[part]));
  }
  return out;
}

/** What the camera fits: the visible building, without the site or terrain, which can dwarf it. */
export function fitIds(now: Xeo): string[] {
  const all = now.viewer.scene.visibleObjectIds;
  const building = all.filter((id) => !GROUND.test(now.elements.get(id)?.name ?? '') && now.elements.get(id)?.cls !== 'IfcSite');
  return building.length ? building : all;
}
