import { useState } from 'react';
import { useWs } from '../../state';
import { upload } from './upload';

/** The programme's PDF dropped anywhere on the panel (the browser would otherwise open it). */
export function useDrop() {
  const ws = useWs();
  const [over, setOver] = useState(false);
  const [refused, setRefused] = useState('');
  const ready = !!ws.result?.boq?.length;
  const busy = ws.work?.kind === 'programme' && !ws.work.done;
  const can = ws.editor && ready && !busy;
  const why = !ws.editor ? 'Only a QS or Admin who can edit this project uploads the programme.' : !ready ? 'Generate the BOQ in Takeoff first: the programme waits for it.' : busy ? 'The programme is still being read.' : '';
  const handlers = {
    onDragOver: (event: React.DragEvent) => { event.preventDefault(); setOver(true); },
    onDragLeave: (event: React.DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(false); },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setOver(false);
      const file = event.dataTransfer.files[0];
      if (!file) return;
      if (!/\.pdf$/i.test(file.name)) setRefused('The programme must be a PDF.');
      else if (!can) setRefused(why);
      else { setRefused(''); upload(ws.start, event.dataTransfer.files); }
    },
  };
  return { over, refused, can, ready, handlers };
}
