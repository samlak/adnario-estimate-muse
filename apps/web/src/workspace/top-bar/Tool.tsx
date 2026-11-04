import { type ReactNode } from 'react';

export const Tool = ({ title, on, onClick, children }: { title: string; on?: boolean; onClick: () => void; children: ReactNode }) => (
  <button title={title} className={`tool ${on ? 'on' : ''}`} onClick={onClick}>{children}</button>
);
