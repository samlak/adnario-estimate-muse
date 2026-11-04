import type { Plan } from '../../state';
import { drawReadout } from './drawReadout';

/** Records the model playing the programme as a video: the canvas each frame, with the readout and a progress bar
 * drawn on it; when stopped, the video downloads. Returns the recorder. */
export function record4d(source: HTMLCanvasElement, plan: Plan, day: () => number, money: boolean, projectName: string, onStop: () => void): MediaRecorder {
  const frame = document.createElement('canvas');
  frame.width = source.width;
  frame.height = source.height;
  const pen = frame.getContext('2d')!;
  let drawing = true;
  const draw = () => {
    if (!drawing) return;
    const unit = frame.height / 900; // sizes as on a 900px-high screen
    pen.fillStyle = '#f4f4f2';
    pen.fillRect(0, 0, frame.width, frame.height);
    pen.drawImage(source, 0, 0);
    drawReadout(pen, frame.width, unit, plan, day(), money, projectName);
    // how far through the programme
    pen.fillStyle = '#e1e4e8';
    pen.fillRect(0, frame.height - 6 * unit, frame.width, 6 * unit);
    pen.fillStyle = '#1f3a5f';
    pen.fillRect(0, frame.height - 6 * unit, (frame.width * (day() + 1)) / plan.days.length, 6 * unit);
    requestAnimationFrame(draw);
  };
  draw();
  const recorder = new MediaRecorder(frame.captureStream(30), { mimeType: 'video/webm' });
  const parts: Blob[] = [];
  recorder.ondataavailable = (event) => parts.push(event.data);
  recorder.onstop = () => {
    drawing = false;
    onStop();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(parts, { type: 'video/webm' }));
    link.download = `${projectName} 4D.webm`;
    link.click();
  };
  recorder.start();
  return recorder;
}
