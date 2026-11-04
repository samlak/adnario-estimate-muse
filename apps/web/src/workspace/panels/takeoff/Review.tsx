import { useWs, type Result } from '../../state';

export function Review({ result }: { result: Result }) {
  const ws = useWs();
  const held = result.types.filter((type) => type.mapping.held);
  const left = result.types.filter((type) => !type.mapping.held && (type.mapping.decision === 'exclude' || type.mapping.decision === 'unmapped') && !/billed from/.test(type.mapping.reason));
  const TONE = { high: 'bg-danger-50 text-danger', medium: 'bg-accent-50 text-accent-600', low: 'bg-canvas text-[#59636e]' };
  return (
    <>
      {result.questions.length > 0 && (
        <section className="mb-3 rounded-2xl border border-line px-3 py-3">
          <h3 className="pb-1 text-[13px] font-bold">Questions for the QS</h3>
          {result.questions.map((question, index) => (
            <div key={index} className="border-b border-line py-2.5 text-[12.5px] last:border-0">
              <span className={`pill mr-1.5 ${TONE[question.severity]}`}>{question.severity}</span>{question.question}
              {question.line_codes.length > 0 && <p className="mt-1 text-[11.5px] text-[#6b7581]">About {question.line_codes.map((code) => result.takeoff_lines.find((line) => line.code === code)?.description ?? code).join('; ')}</p>}
            </div>
          ))}
        </section>
      )}
      {[['Held: the AI was unsure. Bill them?', held, 'Bill as suggested'], ['Left out of the BOQ: include them?', left, 'Bill it']].map(([title, types, yes]) => (types as typeof held).length > 0 && (
        <section key={title as string} className="mb-3 rounded-2xl border border-line px-3 py-3">
          <h3 className="pb-1 text-[13px] font-bold">{title as string}</h3>
          {(types as typeof held).map((type) => (
            <div key={type.key} className="border-b border-line py-2.5 last:border-0">
              <button className="text-left text-[12.5px] font-semibold hover:text-primary" onClick={() => ws.show(type.gids)}>{type.type}</button>
              <p className="text-[11.5px] leading-[1.45] text-[#6b7581]">{type.class.replace(/^Ifc/, '')} ×{type.count}{type.mapping.reason ? ` · ${type.mapping.reason}` : ''}</p>
              {type.mapping.items[0] && <p className="text-[11.5px] text-[#59636e]">{type.mapping.items[0].description}</p>}
              <div className="mt-2 flex gap-2 text-[12px]">
                <button disabled={!ws.editor || !type.mapping.items.length} onClick={() => void ws.edit({ op: 'type', code: type.key, decision: 'bill' })} className="rounded-md border border-line px-2.5 py-1 disabled:text-[#b5bbc1]">{yes as string}</button>
                <button disabled={!ws.editor} onClick={() => void ws.edit({ op: 'type', code: type.key, decision: 'exclude' })} className="rounded-md px-2.5 py-1 text-[#59636e]">Leave out</button>
              </div>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
