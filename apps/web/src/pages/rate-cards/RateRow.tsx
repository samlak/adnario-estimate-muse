import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { num } from '@/lib/format';
import { outputOf, rateOf, type Items, type Prices, type Rate } from '@/lib/ratecard';
import { BuildUp } from './BuildUp';
import { DASH } from './Dash';

/** A work item: its rate worked out from its build-up, its output per day and gang; it opens to show the build-up. */
export function RateRow({ rate, prices, items, expanded, onToggle }: { rate: Rate; prices: Prices; items: Items; expanded: boolean; onToggle: () => void }) {
  const value = rateOf(rate, prices, items);
  const output = outputOf(rate, prices);
  return (
    <Fragment>
      <tr className="h-[40.6px] cursor-pointer border-b border-line hover:bg-paper/60" onClick={onToggle}>
        <td className="px-3">{rate.code}</td>
        <td className="truncate pr-3"><span className="inline-flex w-7 text-[#7b848e]">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>{rate.description}</td>
        <td className="px-3">{rate.unit}</td>
        <td className="px-3 text-right">{value == null ? DASH : value.toLocaleString('en-US')}</td>
        <td className="pl-6 pr-3">
          {output ? (
            <span className="flex items-center gap-3">
              <span className="w-8 text-right">{num(output.perDay)}</span>
              <span className="flex items-center gap-1 text-[13px] text-[#59636e]">{rate.unit}/day <ChevronDown size={14} className="ml-6" /></span>
            </span>
          ) : <span className="pl-10">{DASH}</span>}
        </td>
        <td className="truncate px-3">{output?.gang ?? DASH}</td>
      </tr>
      {expanded && <BuildUp rate={rate} value={value} prices={prices} items={items} />}
    </Fragment>
  );
}
