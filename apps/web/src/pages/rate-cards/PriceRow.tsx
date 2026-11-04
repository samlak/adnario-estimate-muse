import type { Price } from '@/lib/ratecard';
import { Cell, shown, toNumber } from './Cell';
import { DASH } from './Dash';
import type { Editing } from './editing';
import { RemoveRow } from './RemoveRow';

/** A price (material, labour or plant): its name, unit and price typed over in place. Labour and gang are for work
 * items only: shown blank when the table has them. */
export function PriceRow({ price, labourColumns, edit }: { price: Price; labourColumns: boolean; edit: Editing }) {
  return (
    <tr className="group h-[40.6px] border-b border-line hover:bg-paper/60">
      <td className="px-3 text-[#9aa1a9]">{DASH}</td>
      <td className="pr-3" title={price.note || undefined}><Cell value={price.name} label="Description" canEdit={edit.canEdit} onSave={(name) => name && edit.change(price.id, { name })} /></td>
      <td className="px-1.5"><Cell value={price.unit} label="Unit" canEdit={edit.canEdit} onSave={(unit) => edit.change(price.id, { unit })} /></td>
      <td className="px-1.5 text-right"><Cell value={shown(price.price)} label="Price" number canEdit={edit.canEdit} onSave={(text) => edit.change(price.id, { price: toNumber(text) })} /></td>
      {labourColumns && <><td /><td /></>}
      <td>{edit.canEdit && <RemoveRow onClick={() => edit.remove(price.id, price.name)} />}</td>
    </tr>
  );
}
