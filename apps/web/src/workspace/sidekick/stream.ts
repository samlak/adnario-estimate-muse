/** Reading an estimate run's progress: the API answers a run (POST /estimate, or /estimates/{id}/revise) with
 * Server-Sent Events, "event: name\ndata: {json}\n\n", ending with `result` or `error`. GET /estimates/{id}/events
 * sends the same for a run already going, from its start. */

import { ApiError, messageOf } from '@/lib/api';

export async function streamRun(
  path: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void,
  method: 'POST' | 'GET' = 'POST',
): Promise<void> {
  const file = body instanceof Blob || body instanceof FormData; // a file or form is sent as it is (an upload), anything else as JSON
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: body === undefined || file ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : file ? body : JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    const answer = await response.json().catch(() => ({}));
    throw new ApiError(messageOf(answer, response.statusText), response.status);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = /^event: (.*)$/m.exec(chunk)?.[1];
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      if (event && data) onEvent(event, JSON.parse(data));
    }
  }
}

/** A file as base64, for the project information sent with a run. */
export async function base64Of(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(text);
}
