import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { outputOf, rateOf, type Items, type Prices, type Rate } from '@/lib/ratecard';
import { BuildUp } from './BuildUp';
import { Cell, shown, toNumber } from './Cell';
import { DASH } from './Dash';
import type { Editing } from './editing';
import { Labour } from './Labour';
import { RemoveRow } from './RemoveRow';

/** A work item: code, description and unit typed over in place; its rate worked out from its build-up (typed when it
 * has none); its labour figure and gang; it opens to show the build-up. */
export function RateRow({ rate, prices, items, expanded, onToggle, edit }: {
  rate: Rate; prices: Prices; items: Items; expanded: boolean; onToggle: () => void; edit: Editing;
}) {
  const value = rateOf(rate, prices, items);
  const output = outputOf(rate, prices);
  const built = rate.lines.length > 0;
  return (
    <Fragment>
      <tr className="group h-[40.6px] border-b border-line hover:bg-paper/60">
        <td className="pl-1.5"><Cell value={rate.code} label="Code" canEdit={edit.canEdit} onSave={(code) => code && edit.change(rate.id, { code })} /></td>
        <td className="pr-3">
          <span className="flex items-center">
            <button className="grid h-[30px] w-7 shrink-0 place-items-center text-[#7b848e]" title={expanded ? 'Close the build-up' : 'Open the build-up'} onClick={onToggle}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
            <Cell value={rate.description} label="Description" canEdit={edit.canEdit} onSave={(name) => name && edit.change(rate.id, { name })} />
          </span>
        </td>
        <td className="px-1.5"><Cell value={rate.unit} label="Unit" canEdit={edit.canEdit} onSave={(unit) => edit.change(rate.id, { unit })} /></td>
        <td className="px-1.5 text-right">
          {built
            ? <span className="px-1.5" title="Worked out from its build-up">{value == null ? DASH : value.toLocaleString('en-US')}</span>
            : <Cell value={shown(rate.price)} label="Rate" number canEdit={edit.canEdit} onSave={(text) => edit.change(rate.id, { price: toNumber(text) })} />}
        </td>
        <td className="pl-6 pr-3"><Labour rate={rate} prices={prices} edit={edit} /></td>
        <td className="truncate px-3">{output?.gang ?? DASH}</td>
        <td>{edit.canEdit && <RemoveRow onClick={() => edit.remove(rate.id, rate.description)} />}</td>
      </tr>
      {expanded && <BuildUp rate={rate} value={value} prices={prices} items={items} edit={edit} />}
    </Fragment>
  );
}
