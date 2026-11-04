import type { Price } from '@/lib/ratecard';
import { DASH } from './Dash';
import { PriceCell } from './PriceCell';

/** A price (material, labour or plant), edited in place. */
export function PriceRow({ price, onPrice }: { price: Price; onPrice: (value: number) => void }) {
  return (
    <tr className="h-[40.6px] border-b border-line">
      <td className="px-3">{DASH}</td>
      <td className="truncate pr-3" title={price.note || price.name}>{price.name}</td>
      <td className="truncate px-3">{price.unit}</td>
      <td className="px-3 text-right"><PriceCell value={price.price} onChange={onPrice} /></td>
      <td className="pl-6 text-[#b5bbc1]">–</td>
      <td className="px-3">{DASH}</td>
    </tr>
  );
}
