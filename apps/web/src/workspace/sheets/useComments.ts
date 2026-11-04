import { useApi } from '@/lib/store';
import { useWs } from '../state';
import type { Comment } from './types';

/** The project's comments (fetched once, shared), and how many are on one thing. */
export function useComments() {
  const { projectId } = useWs();
  const comments = useApi<Comment[]>(`/projects/${projectId}/comments`).data ?? [];
  const count = (kind: string, ref: string) => comments.filter((comment) => comment.on_kind === kind && comment.on_ref === ref).length;
  return { comments, count };
}
