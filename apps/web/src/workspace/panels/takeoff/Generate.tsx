/** The BOQ in the Takeoff panel (README §7.3): Generate BOQ, its items with quantities and rates the QS can change,
 * a line added by hand, and the bills as a document in full view. */
import { ListChecks, Loader2 } from 'lucide-react';
import { useWs } from '../../state';

export function Generate() {
  const ws = useWs();
  const working = ws.work?.kind === 'boq' ? ws.work : null;
  const busy = !!ws.work && !ws.work.done;
  return (
    <section className="px-2.5 pt-4 text-[13px]">
      <h3 className="text-[17px]">{working && !working.done ? 'Generating the BOQ…' : 'No BOQ yet'}</h3>
      <p className="mt-2 leading-[1.6] text-[#6b7581]">The takeoff is measured. Generate the BOQ to group it into a contractor's bill: the AI groups lines that are the same work and words them in the firm's style; code checks every line is used once and adds up the quantities.</p>
      {working && !working.done ? (
        <p className="mt-4 flex items-center gap-2"><Loader2 size={14} className="animate-spin text-primary" /> {(working.feed[0] as { text?: string } | undefined)?.text ?? 'Grouping the takeoff into BOQ items, element by element'}</p>
      ) : (
        <button className="btn-primary mt-4 h-[34px] rounded-lg px-3.5" disabled={!ws.editor || busy} onClick={() => ws.start('boq')}><ListChecks size={15} /> Generate BOQ</button>
      )}
      {working?.error && <p className="mt-2 text-danger">{working.error}</p>}
    </section>
  );
}
