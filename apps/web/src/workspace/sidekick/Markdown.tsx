import type { ReactNode } from 'react';
import ReactMarkdown, { type Components, defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** What a link in the text does: the action for its href (element:REF, boq:B1A…), or undefined for a plain link. */
export type LinkAction = (href: string, label?: string) => (() => void) | undefined;

/** The AI writes markdown (the brief, the review summary, Adnario AI's answers): GitHub-flavoured, so nested lists,
 * tables and lines that run on all work. Rendered as elements, never as HTML, so nothing in the text can run. */
export function Markdown({ text, links, children }: { text: string; links?: LinkAction; children?: ReactNode }) {
  const components: Components = {
    h1: ({ children }) => <h5>{children}</h5>,
    h2: ({ children }) => <h5>{children}</h5>,
    h3: ({ children }) => <h5>{children}</h5>,
    h4: ({ children }) => <h5>{children}</h5>,
    a: ({ href = '', children }) => {
      const act = links?.(href, typeof children === 'string' ? children : undefined);
      // a link, not a button, so a long label wraps with the line around it; it acts here instead of going anywhere
      if (act)
        return (
          <a
            className="link"
            href={href}
            onClick={(event) => {
              event.preventDefault();
              act();
            }}
          >
            {children}
          </a>
        );
      return /^https?:/.test(href) ? (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      ) : (
        <>{children}</>
      );
    },
    table: ({ children }) => (
      <div className="mdTable">
        <table>{children}</table>
      </div>
    ),
  };
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        // our own links (element:, boq:…) are not web addresses; the default would drop them
        urlTransform={(url) => (links?.(url) ? url : defaultUrlTransform(url))}
      >
        {text}
      </ReactMarkdown>
      {children}
    </div>
  );
}
