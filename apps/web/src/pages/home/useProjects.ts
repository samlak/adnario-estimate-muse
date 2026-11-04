import { useApi } from '@/lib/store';
import { Project } from './types';

/** The projects this person is on; an Admin sees all of the firm's (the server decides). */
export const useProjects = () => useApi<Project[]>('/projects').data ?? [];
