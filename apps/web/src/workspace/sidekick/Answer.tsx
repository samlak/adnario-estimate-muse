import type { SidekickLinks } from './types';
import { Markdown } from './Markdown';

const LINK = /^(element|week|boq|activity|panel):(.+)$/;

/** An answer: markdown, with its links [label](element:REF | week:N | boq:CODE | activity:ID | panel:NAME) as buttons. */
export function Answer({ text, links }: { text: string; links: SidekickLinks }) {
  const act = (href: string, label?: string) => {
    const link = LINK.exec(href);
    if (!link) return undefined;
    const [, kind, value] = link;
    return {
      element: () => links.element(value, label ?? value),
      week: () => links.week(Number(value)),
      boq: () => links.line(value),
      activity: () => links.activity(value),
      panel: () => links.panel(value),
    }[kind as 'element' | 'week' | 'boq' | 'activity' | 'panel'];
  };
  return <Markdown text={text} links={act} />;
}
