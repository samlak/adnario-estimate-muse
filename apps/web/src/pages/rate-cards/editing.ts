import type { Row } from '@/lib/ratecard';

/** What a row on the page may do to the card: change itself, or ask to be deleted. */
export type Editing = {
  canEdit: boolean;
  change: (id: string, fields: Partial<Row>) => void;
  remove: (id: string, name: string) => void;
};
