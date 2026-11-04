import { useEffect, useRef } from 'react';
import { Answer } from './Answer';
import { CopyButton } from './CopyButton';
import { Steps } from './Steps';
import type { Message, SidekickLinks } from './types';
import { Wave } from './Wave';

/** What has been said: each question, and each answer with the steps behind it; kept scrolled to the newest. */
export function ChatMessages({ said, busy, links }: { said: Message[]; busy: boolean; links: SidekickLinks }) {
  const end = useRef<HTMLDivElement>(null);
  // a block body: scrollIntoView returns a Promise in recent Chrome, and an effect may only return a cleanup
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [said]);
  return (
    <>
      {said.map((each, index) => {
        if (each.role === 'user') return <div key={index} className="said user">{each.text}</div>;
        const working = busy && index === said.length - 1;
        return (
          <div key={index} className="said assistant">
            {each.steps.length > 0 && <Steps steps={each.steps} working={working} />}
            {working && !each.text && (
              <div className="working">
                <Wave /> {each.steps.length ? 'Working it out' : 'Thinking'}…
              </div>
            )}
            <Answer text={each.text} links={links} />
            {working && each.text && <Wave />}
            {!working && each.text && <CopyButton text={each.text} />}
          </div>
        );
      })}
      <div ref={end} />
    </>
  );
}
