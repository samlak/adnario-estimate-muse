import { KIND_LABEL, lineOf, type Items, type Price, type Prices, type Rate } from '@/lib/ratecard';
import { num } from '@/lib/format';
import { DASH } from './Dash';

/** A work item's recipe: a quantity of each price, then the percentage additions. */
export function BuildUp({ rate, value, prices, items }: { rate: Rate; value: number | null; prices: Prices; items: Items }) {
  const { additions } = rate;
  return (
    <tr className="border-b border-line bg-paper/70">
      <td />
      <td colSpan={5} className="py-3 pr-6">
        <table className="w-full text-[13px]">
          <thead><tr className="text-[11px] uppercase tracking-[0.08em] text-[#7b848e]"><th className="py-1 text-left font-semibold">Build-up</th><th className="text-right font-semibold">Qty</th><th className="pl-3 text-left font-semibold">Unit</th><th className="text-right font-semibold">Price</th><th className="text-right font-semibold">Amount</th></tr></thead>
          <tbody>
            {rate.lines.map((line, index) => {
              const shown = lineOf(line, prices, items);
              return (
                <tr key={index} className="border-t border-line/70">
                  <td className="py-1.5"><span className="mr-2 font-mono text-[11px] text-[#9aa1a9]">{KIND_LABEL[line.kind]}</span>{shown.name}</td>
                  <td className="text-right font-mono">{num(line.qty, 4)}</td>
                  <td className="pl-3">{shown.unit}</td>
                  <td className="text-right font-mono">{shown.unitPrice == null ? <span className="text-danger">no price</span> : shown.unitPrice.toLocaleString('en-US')}</td>
                  <td className="text-right font-mono">{shown.amount == null ? DASH : Math.round(shown.amount).toLocaleString('en-US')}</td>
                </tr>
              );
            })}
            <tr className="border-t border-line text-[#59636e]">
              <td className="py-1.5" colSpan={4}>Additions: material {additions.material}%, labour {additions.labour}%, risk {additions.risk}%</td>
              <td className="text-right font-mono font-semibold text-ink">{value == null ? 'blank' : `₦${value.toLocaleString('en-US')}`}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}
