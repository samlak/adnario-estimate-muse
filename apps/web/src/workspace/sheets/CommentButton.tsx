import { MessageSquare } from 'lucide-react';
import { useWs, type Topic } from '../state';
import { useComments } from './useComments';

/** A thing's comments: its count when it has some, else an icon shown on hover (in a `group` row); it opens the
 * thing's own thread in the side sheet. */
export function CommentButton({ topic }: { topic: Topic }) {
  const ws = useWs();
  const said = useComments().count(topic.kind, topic.ref);
  return (
    <button title="Comment on this" aria-label="Comment on this"
      className={`ml-1.5 inline-flex items-center gap-1 rounded-md px-1 py-0.5 align-middle text-[11px] text-primary hover:bg-primary-50 ${said ? 'bg-accent-50 text-accent-600' : 'opacity-0 focus:opacity-100 group-hover:opacity-100'}`}
      onClick={(event) => { event.stopPropagation(); ws.discuss(topic); }}>
      <MessageSquare size={13} />{said > 0 && said}
    </button>
  );
}
