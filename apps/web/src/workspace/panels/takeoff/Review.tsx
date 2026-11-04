/** What the QS settles: the types the AI held, the types left out of the BOQ, then each question as its
 * own card with the BOQ items it is about; a click shows their elements. */
import { CommentButton } from '../../sheets/CommentButton';
import { useWs, type Result } from '../../state';

const TONE = { high: 'bg-danger-50 text-danger', medium: 'bg-accent-50 text-accent-600', low: 'bg-canvas text-[#59636e]' };

export function Review({ result }: { result: Result }) {
  const ws = useWs();
  const held = result.types.filter((type) => type.mapping.held);
  const left = result.types.filter((type) => !type.mapping.held && (type.mapping.decision === 'exclude' || type.mapping.decision === 'unmapped') && !/billed from/.test(type.mapping.reason));
  const groups: [string, typeof held][] = [['Held: the AI was unsure. Bill them?', held], ['Left out of the BOQ: include them?', left]];
  return (
    <>
      {groups.map(([title, types]) => types.length > 0 && (
        <section key={title} className="mb-3 rounded-2xl border border-line px-3 py-3">
          <h3 className="pb-1 text-[13px] font-bold">{title}</h3>
          {types.map((type) => (
            <div key={type.key} className="border-b border-line py-2.5 last:border-0">
              <button className="text-left text-[12.5px] font-semibold hover:text-primary" onClick={() => ws.show(type.gids)}>{type.type}</button>
              <p className="text-[11.5px] leading-[1.45] text-[#6b7581]">
                {type.class.replace(/^Ifc/, '')} ×{type.count}{type.mapping.reason ? ` · ${type.mapping.reason}` : ''}{type.mapping.items[0] ? `. ${type.mapping.items[0].description}` : ''}
              </p>
              {ws.editor && (
                <div className="mt-2 flex gap-2 text-[12px]">
                  {/* a type with no BOQ item is counted, by number */}
                  <button onClick={() => void ws.edit({ op: 'type', code: type.key, decision: 'bill' })} className="rounded-md border border-line px-2.5 py-1 hover:bg-paper">
                    {type.mapping.items.length ? 'Bill as suggested' : `Count ×${type.count}`}
                  </button>
                  <button onClick={() => void ws.edit({ op: 'type', code: type.key, decision: 'exclude' })} className="rounded-md bg-paper px-2.5 py-1 text-[#59636e] hover:text-ink">Leave out</button>
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
      {result.questions.map((question, index) => {
        const lines = result.takeoff_lines.filter((line) => question.line_codes.includes(line.code));
        const refs = [...new Set(question.line_codes.map((code) => {
          const item = result.boq.find((each) => each.lines?.includes(code));
          return item ? result.refs[item.code] ?? item.code : code;
        }))];
        // code's questions name their own elements (some, like one that could not be measured, are on no line)
        const gids = question.refs?.length ? question.refs : [...new Set(lines.flatMap((line) => line.gids))];
        return (
          <section key={index} id={`question-${index}`} className="group mb-3 rounded-2xl border border-line px-3 py-3 text-[12.5px] leading-[1.5]">
            <p><span className={`pill mr-1.5 uppercase ${TONE[question.severity]}`}>{question.severity}</span>{question.question}</p>
            <div className="mt-1 flex items-end gap-2">
                <button className="flex-1 text-left text-[11.5px] text-[#6b7581] hover:text-primary disabled:hover:text-[#6b7581]" disabled={!gids.length} onClick={() => ws.show(gids)}>
                  {refs.join(', ')}{gids.length > 0 && ` · ${gids.length} ${gids.length === 1 ? 'element' : 'elements'}, click to show`}
                </button>
                <CommentButton topic={{ kind: 'question', ref: String(index), label: question.question }} />
              </div>
          </section>
        );
      })}
    </>
  );
}
