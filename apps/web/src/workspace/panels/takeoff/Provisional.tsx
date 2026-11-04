import { num } from '@/lib/format';
import { useWs, type Item, type Result } from '../../state';
import { Head } from './Head';
import { Generate } from './Generate';

export function Provisional({ result }: { result: Result }) {
  const ws = useWs();
  const inBoq = new Set(result.boq.map((line) => line.code));
  return (
    <>
      <p className="mb-1.5 text-[12px] text-[#59636e]">Not in the model; proposed by the AI review, with quantities code works out from what each is based on. Add the ones you want to the BOQ.</p>
      <table className="w-full text-[12px]">
        <Head cols={[['Item'], ['Description'], ['Qty', 'right'], ['Unit'], ['']]} />
        <tbody>
          {result.provisional.map((item) => {
            const added = inBoq.has(item.code);
            return (
              <tr key={item.code} className="border-b border-line align-top">
                <td className="py-1.5 pl-1.5">{item.code}</td>
                <td className="py-1.5 pr-2">{item.description}<small className="block text-[11px] text-[#6b7581]">{item.reason}</small></td>
                <td className="py-1.5 text-right">{item.qty == null ? '' : num(item.qty)}</td>
                <td className="py-1.5 pl-2">{item.unit}</td>
                <td className="py-1 pl-2 text-right">
                  <button disabled={!ws.editor || !result.boq.length} title={result.boq.length ? '' : 'Generate the BOQ first'} className={`whitespace-nowrap rounded-md border px-2 py-1 ${added ? 'border-success-100 bg-success-50 text-success' : 'border-line'}`}
                    onClick={() => void ws.edit(added ? { op: 'remove_line', code: item.code } : { op: 'add_provisional', code: item.code })}>
                    {added ? 'Added' : 'Add to BOQ'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
