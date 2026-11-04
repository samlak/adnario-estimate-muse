import { ArrowUp, Square } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MAX_BOX } from './constants';

/** The question box: it grows with what is typed (a scrollbar only once it is as tall as it gets); Enter asks,
 * Shift+Enter starts a new line; while an answer is written the button stops it. */
export const AskBox = forwardRef<HTMLTextAreaElement | null, {
  draft: string; setDraft: (text: string) => void; busy: boolean; projectName: string; onAsk: () => void; onStop: () => void; onFocusQuestion?: () => void;
}>(function AskBox({ draft, setDraft, busy, projectName, onAsk, onStop, onFocusQuestion }, ref) {
  const box = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => box.current as HTMLTextAreaElement);
  useEffect(() => {
    const area = box.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, MAX_BOX)}px`;
    area.style.overflowY = area.scrollHeight > MAX_BOX ? 'auto' : 'hidden';
  }, [draft]);
  return (
    <form className="sidekickAsk" onSubmit={(event) => { event.preventDefault(); if (busy) onStop(); else onAsk(); }}>
      <textarea
        ref={box}
        rows={1}
        aria-label="Your question"
        placeholder={`Ask about ${projectName}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onAsk();
          }
        }}
      />
      {busy ? (
        <button className="send" title="Stop"><Square /></button>
      ) : (
        <button className="send" disabled={!draft.trim()} title="Ask (Enter)" onClick={onFocusQuestion}><ArrowUp /></button>
      )}
    </form>
  );
});
