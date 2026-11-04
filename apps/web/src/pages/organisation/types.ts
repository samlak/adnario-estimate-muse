import { type Role } from '@/lib/store';

export type Person = { id: string; name: string; email: string; role: Role; seen_at: string | null; invited: boolean };
