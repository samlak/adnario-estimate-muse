import { type Role } from '@/lib/store';

export type DemoFirm = { firm: string; people: { name: string; email: string; role: Role }[] };
