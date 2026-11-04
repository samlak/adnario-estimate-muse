import { useEffect, type RefObject } from 'react';

/** Pinching or ctrl+wheel over the model zooms the model, never the page; marks pass the wheel on to the model. */
export function useWheelToModel(box: RefObject<HTMLDivElement>, canvas: RefObject<HTMLCanvasElement>) {
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
}
