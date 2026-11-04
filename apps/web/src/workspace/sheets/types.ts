import { type Role } from '@/lib/store';

export type Member = { id: string; name: string; role: Role; access: 'edit' | 'view' };

export type Comment = { id: string; on_kind: string; on_ref: string | null; on_label: string; text: string; file: { name: string; size: number } | null; created_at: string; person_id: string; name: string };
