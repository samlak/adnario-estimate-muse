import type { PointerEvent } from 'react';

/** A handle on the edge between a panel and the model: drag it and `onSize` gets the panel's new size in pixels.
 * `x`: it sits right of the panel before it (a wider panel to the right); `y`: above the panel after it (taller upwards).
 * It takes no room in the layout: it overlaps the panel's border. */
export function Resizer({ axis, onSize }: { axis: 'x' | 'y'; onSize: (size: number) => void }) {
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const panel = (axis === 'x' ? handle.previousElementSibling : handle.nextElementSibling) as HTMLElement | null;
    if (!panel) return;
    const box = panel.getBoundingClientRect();
    const [from, start] = axis === 'x' ? [event.clientX, box.width] : [event.clientY, box.height];
    handle.setPointerCapture(event.pointerId);
    const move = (next: globalThis.PointerEvent) => onSize(axis === 'x' ? start + next.clientX - from : start - (next.clientY - from));
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
  return (
    <div
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label="Drag to resize"
      onPointerDown={down}
      className={`relative z-10 shrink-0 touch-none transition-colors hover:bg-primary/40 active:bg-primary/60 ${axis === 'x' ? '-mx-[3px] w-[6px] cursor-col-resize' : '-my-[3px] h-[6px] cursor-row-resize'}`}
    />
  );
}
