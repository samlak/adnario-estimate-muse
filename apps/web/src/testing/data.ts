/** The data the web tests use, in one place. */
import type { Price, Rate } from '@/lib/ratecard';
import type { ApiProgramme } from '@/workspace/state';

export const programme = {
  start: '2026-12-01',
  days: ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-08', '2026-12-09'],
  activities: [
    { id: 1, code: '1', name: 'SITE', summary: true, level: 0, start: 0, finish: 5 },
    { id: 2, code: '2', name: 'Clear', summary: false, level: 1, start: 0, finish: 2 },
    { id: 3, code: '3', name: 'Set out', summary: false, level: 1, start: 2, finish: 5 },
    { id: 4, code: '4', name: 'Handover', summary: false, level: 1, start: 5, finish: 5 },
  ],
  links: [{ before: 2, after: 3 }, { before: 3, after: 4 }],
  cash_flow: [],
} as unknown as ApiProgramme;

export const rates = [
  { code: 'A1', section: 'Substructure', description: 'Excavate' },
  { code: 'A2', section: 'Substructure', description: 'Blinding' },
  { code: 'B1', section: 'Frame', description: 'Columns' },
] as Rate[];

export const prices = [
  { name: 'Sand', kind: 'MATERIAL' },
  { name: 'Cement', kind: 'MATERIAL' },
  { name: 'Mason', kind: 'LABOUR' },
] as Price[];

export const me = {
  person: { id: 'p1', name: 'Tunde Bello', email: 'qs@demo.adnario.app', role: 'qs' },
  firm: { id: 'f1', name: 'Demo QS', currency: 'NGN' },
  can: [],
};

export const chats = [{ id: 'c1', title: 'Project cost', updated_at: '2026-11-01T10:00:00Z' }];

/** A sidekick answer as the server streams it: it says what it will check, looks up the totals, then answers with links. */
export const answerStream: [string, unknown][] = [
  ['chat', { id: 'c2' }],
  ['token', { text: 'Let me check the totals.' }],
  ['tool', { id: 't1', name: 'boq_totals', args: {}, seconds: 2 }],
  ['result', { id: 't1', text: '{"total": 152000000}' }],
  ['title', { title: 'Total cost' }],
  ['token', { text: 'The total is ₦152m; most is in [the frame](boq:B1A), busiest in [week 3](week:3).' }],
];
