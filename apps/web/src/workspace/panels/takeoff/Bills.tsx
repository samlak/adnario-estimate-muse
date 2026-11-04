import { Fragment, useState } from 'react';
import { naira } from '@/lib/format';
import { useWs, type Item, type Result } from '../../state';
import { Head } from './Head';
import { Edit } from './EditCell';
import { CommentButton } from '../../sheets/CommentButton';

/** The bills as a document: the summary, A Preliminaries, then each bill. */
export function Bills({ result }: { result: Result }) {
  const ws = useWs();
  const totals = result.totals;
  const [bill, setBill] = useState('summary');
  if (!totals) return null;
  const bills = Object.entries(totals.bills);
  const pricing = result.pricing;
  const tabs = [['summary', 'Summary'], ['A', 'A · Preliminaries'], ...bills.map(([letter, each]) => [letter, `${letter} · ${each.name}`])];
  const shown = bills.find(([letter]) => letter === bill);
  const amount = (line: Item) => (line.rate == null || line.qty == null ? null : line.rate * line.qty);
  return (
    <>
      <div className="flex gap-1 border-b border-line text-[13px]">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setBill(id)} className={`rounded-t-lg border px-3.5 py-2 ${bill === id ? '-mb-px border-line border-b-white bg-white font-semibold' : 'border-transparent text-[#59636e]'}`}>{label}</button>
        ))}
      </div>
      <table className="mt-3.5 w-full overflow-hidden rounded-xl text-[13px]">
        <Head cols={bill === 'summary' || bill === 'A' ? [['Bill'], ['Description'], ['Amount', 'right']] : [['Item'], ['Description'], ['Qty', 'right'], ['Unit'], ['Rate', 'right'], ['Amount', 'right']]} />
        <tbody>
          {bill === 'summary' && (
            <>
              <BillRow letter="A" name="Preliminaries" amount={totals.prelims} />
              {bills.map(([letter, each]) => (
                <Fragment key={letter}>
                  <BillRow letter={letter} name={each.name} amount={each.total} />
                  {Object.entries(each.sections).map(([name, value], index) => (
                    <tr key={name} className="border-b border-line"><td /><td className="py-2.5"><span className="inline-block w-6 text-[#9aa1a9]">{index + 1}</span>{name}</td><td className="py-2.5 pr-4 text-right">{naira(value)}</td></tr>
                  ))}
                </Fragment>
              ))}
              <tr className="border-b border-line"><td /><td className="py-2.5">Contingency {pricing.contingency}%</td><td className="py-2.5 pr-4 text-right">{naira(totals.contingency)}</td></tr>
              <tr className="border-b border-line"><td /><td className="py-2.5">VAT {pricing.vat}%</td><td className="py-2.5 pr-4 text-right">{naira(totals.vat)}</td></tr>
              <tr className="bg-[#f4f3ef] font-bold"><td /><td className="py-3">Total</td><td className="py-3 pr-4 text-right">{naira(totals.total)}</td></tr>
              {totals.unpriced > 0 && <tr><td /><td colSpan={2} className="py-2 text-[12px] text-[#6b7581]">{totals.unpriced} items have no rate and are not in the totals.</td></tr>}
            </>
          )}
          {bill === 'A' && <tr className="border-b border-line"><td className="px-3 py-2.5">A</td><td className="py-2.5">Preliminaries, {pricing.prelims}% of the measured work ({naira(totals.measured)})</td><td className="py-2.5 pr-4 text-right">{naira(totals.prelims)}</td></tr>}
          {shown && Object.entries(shown[1].sections).map(([name, value], index) => (
            <Fragment key={name}>
              <tr className="border-b border-line bg-[#f7f9fb] font-semibold"><td className="px-3 py-2.5">{shown[0]}{index + 1}</td><td className="py-2.5" colSpan={4}>{name}</td><td className="py-2.5 pr-4 text-right">{naira(value)}</td></tr>
              {result.boq.filter((line) => line.bill === shown[0] && line.section === name).map((line) => (
                <tr key={line.code} id={`boq-${line.code}`} className="group cursor-pointer border-b border-line align-top hover:bg-paper" title="Show it on the model" onClick={() => { ws.setLine(line.code); ws.show(line.gids); }}>
                  <td className="px-3 py-2 text-[#6b7581]">{result.refs[line.code]}</td>
                  <td className="py-2 pr-3">{line.description}<CommentButton topic={{ kind: 'boq', ref: line.code, label: `${result.refs[line.code] ?? ''} ${line.description}`.trim() }} /></td>
                  <td className="py-1.5 text-right"><Edit line={line} field="qty" /></td>
                  <td className="py-2 pl-2">{line.unit}</td>
                  <td className="py-1.5 text-right"><Edit line={line} field="rate" /></td>
                  <td className="py-2 pr-4 text-right">{amount(line) == null ? '' : naira(amount(line)!)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </>
  );
}

const BillRow = ({ letter, name, amount }: { letter: string; name: string; amount: number }) => (
  <tr className="border-b border-line bg-[#f7f9fb] font-bold"><td className="px-3.5 py-3">{letter}</td><td className="py-3">{name}</td><td className="py-3 pr-4 text-right">{naira(amount)}</td></tr>
);
