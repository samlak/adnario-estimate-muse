import { useEffect } from 'react';

/** A pinch anywhere in the workspace never zooms the page: over the model it zooms the model (Viewer). */
export function useNoPageZoom() {
  useEffect(() => {
    const wheel = (event: WheelEvent) => { if (event.ctrlKey) event.preventDefault(); };
    const gesture = (event: Event) => event.preventDefault();
    document.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('gesturestart', gesture);
    return () => { document.removeEventListener('wheel', wheel); document.removeEventListener('gesturestart', gesture); };
  }, []);
}
