import { SUGGESTIONS } from './constants';

/** A new chat: a greeting by first name and a few questions to start from. */
export function Hello({ firstName, projectName, onAsk }: { firstName: string; projectName: string; onAsk: (question: string) => void }) {
  return (
    <div className="sidekickHello">
      <h2>
        Hi {firstName}, what would you like to know about <em>{projectName}</em>?
      </h2>
      <p>Ask about its model, takeoff, BOQ, programme or cash flow.</p>
      <div className="sidekickChips">
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} onClick={() => onAsk(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
