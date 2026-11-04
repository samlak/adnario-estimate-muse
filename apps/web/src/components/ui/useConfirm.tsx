import { useState } from 'react';
import { Confirm } from './Confirm';

type Asking = { title: string; message: string; label?: string; onConfirm: () => void };

/** Ask before a delete: `ask({...})` opens the dialog, `dialog` is placed once in the component. */
export function useConfirm() {
  const [asking, ask] = useState<Asking | null>(null);
  const dialog = asking && <Confirm {...asking} onConfirm={() => { ask(null); asking.onConfirm(); }} onCancel={() => ask(null)} />;
  return { ask, dialog };
}
