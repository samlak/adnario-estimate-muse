/** The Cost panel: the total, the rate card it is priced from, what is priced bill by bill, the lines
 * still without a rate, and the summary percentages, which the QS changes per estimate. A Viewer sees the amounts,
 * not the card. */
import { Banknote, Box, CircleCheck, Link2, Loader2, Maximize2 } from 'lucide-react';
import { Empty } from '@/components/ui/Empty';
import { naira, num } from '@/lib/format';
import { useWs } from '../../state';

export function Cost() {
  const ws = useWs();
  const result = ws.result;
  const totals = result?.totals;
  if (!result || !totals || !result.boq.length) return <Empty icon={Box} title="No BOQ yet">Cost comes from the BOQ and the firm's rate library. Start a takeoff and generate the BOQ first.</Empty>;
  const pricing = result.pricing;
  const busy = !!ws.work && !ws.work.done;
  const linking = ws.work?.kind === 'link' ? ws.work : null;
  const pick = linking?.stages.find((stage) => stage.name === 'Pick');
  const card = linking?.stages.find((stage) => stage.name === 'Card');
  const unpriced = result.boq.filter((line) => line.rate == null);
  const percent = (key: 'prelims' | 'contingency' | 'vat', label: string, amount: number) => (
    <tr className="border-b border-line">
      <td className="py-1.5 pl-1">
        {label}{' '}
        {ws.editor ? (
          <input
            type="number" step={0.5} min={0} max={100} defaultValue={pricing[key]} key={pricing[key]}
            className="w-11 rounded border border-transparent px-0.5 text-[12px] hover:border-line"
            onBlur={(event) => { const value = Number(event.target.value); if (value !== pricing[key]) void ws.edit({ op: 'percent', name: key, value }); }}
          />
        ) : `${pricing[key]}`}%
      </td>
      <td className="py-1.5 pr-1 text-right">{naira(amount)}</td>
    </tr>
  );
  return (
    <div className="px-[15px] pt-[15px] text-[12.5px]">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-primary"><Banknote size={13} /> COST</p>
      <h2 className="mt-1.5 text-[20px] font-bold">{naira(totals.total)}</h2>
      <p className="mt-0.5 leading-[1.5] text-[#59636e]">{totals.priced} of {result.boq.length} lines priced · measured work {naira(totals.measured)}{unpriced.length ? `; ${unpriced.length} lines without a rate are not in the total` : ''}</p>
      {ws.seeRates && (
        <section className="mt-3.5 rounded-xl border border-line px-3 py-3">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-[#59636e]">RATE CARD</p>
          <b className="mt-1.5 block text-[13px]">{pricing.rate_card?.title ?? 'Not linked yet'}</b>
          <button className="btn-primary mt-2 h-[30px] rounded-md px-2.5 text-[12.5px] font-medium" disabled={!ws.editor || busy} onClick={() => ws.start('link')}>
            {linking && !linking.done ? <><Loader2 size={14} className="animate-spin" /> Linking to cost…</> : <><Link2 size={14} /> {pricing.rate_card ? 'Link to cost again' : 'Link to cost'}</>}
          </button>
          {linking && !linking.done ? (
            <>
              <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-[#e9ecef]"><div className="h-full rounded-full bg-gradient-to-r from-primary to-[#5b8fc7] transition-all duration-700" style={{ width: `${pick ? (100 * Number(pick.done ?? 0)) / Math.max(1, Number(pick.of ?? 1)) : 0}%` }} /></div>
              <ul className="mt-2.5 space-y-1.5">
                {([['Read the rate card', card ? 'done' : 'start'], [`Pick and check the card item for each line${pick ? `: ${pick.done} of ${pick.of}` : ''}`, pick?.state === 'done' ? 'done' : pick ? 'start' : ''], ['Save the rates', pick?.state === 'done' ? 'start' : '']] as [string, string][]).map(([label, state]) => (
                  <li key={label} className={`flex items-center gap-2 ${state === 'start' ? 'font-semibold' : state ? 'text-[#59636e]' : 'text-[#9aa1a9]'}`}>
                    {state === 'done' ? <CircleCheck size={14} className="text-success" /> : state === 'start' ? <Loader2 size={14} className="animate-spin text-primary" /> : <span className="h-3.5 w-3.5 rounded-full border border-[#c3c7cb]" />} {label}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 leading-[1.5] text-[#59636e]">The AI picks the card item that is the same work for each line; code checks the unit, material and thickness before the card's rate is used. Rates you typed stay as they are.</p>
          )}
          {linking?.error && <p className="mt-2 text-danger">{linking.error}</p>}
        </section>
      )}
      <p className="mt-5 text-[11px] font-semibold tracking-[0.08em] text-[#59636e]">BY BILL</p>
      <table className="mt-1.5 w-full">
        <tbody>
          {Object.entries(totals.bills).map(([letter, bill]) => <tr key={letter} className="border-b border-line"><td className="py-1.5 pl-1">{bill.name}</td><td className="py-1.5 pr-1 text-right">{naira(bill.total)}</td></tr>)}
          {percent('prelims', 'Preliminaries', totals.prelims)}
          {percent('contingency', 'Contingency', totals.contingency)}
          {percent('vat', 'VAT', totals.vat)}
        </tbody>
      </table>
      <button className="btn-ghost mt-2.5 h-[30px] rounded-md px-2.5 text-[12.5px] font-medium" onClick={() => { ws.open('takeoff'); ws.setBoqTab('boq'); ws.setFull(true); }}>
        <Maximize2 size={14} /> Full view: the priced bills
      </button>
      <p className="mt-5 text-[11px] font-semibold tracking-[0.08em] text-[#59636e]">{unpriced.length === 0 ? 'EVERY LINE HAS A RATE' : `WITHOUT A RATE (${unpriced.length})`}</p>
      <ul className="pb-24">
        {unpriced.map((line) => (
          <li key={line.code}>
            <button className="flex w-full gap-2.5 border-b border-line py-2 text-left hover:text-primary" onClick={() => { ws.setLine(line.code); ws.show(line.gids); }}>
              <b className="w-8 shrink-0 font-mono text-[11.5px] font-medium text-[#3b4652]">{result.refs[line.code]}</b>
              <span className="min-w-0 flex-1">{line.description} <small className="text-[#6b7581]">· {line.qty == null ? '' : num(line.qty)} {line.unit}</small>
              {line.rate_note && <small className="block text-[11.5px] text-[#8a929b]">{line.rate_note}</small>}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
