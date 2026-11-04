import { send, useApi } from '@/lib/store';

export type Notice = { id: string; project_id: string | null; title: string; text: string; read: boolean; created_at: string };

export const useNotices = () => useApi<Notice[]>('/notifications').data ?? [];

export const readNotice = (id: string) => send(`/notifications/${id}/read`, 'POST', undefined, '/notifications');
