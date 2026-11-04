import { Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/ui/useConfirm';
import { num } from '@/lib/format';
import { KIND_LABEL, lineOf, type Items, type Line, type Prices, type Rate } from '@/lib/ratecard';
import { Cell, toNumber } from './Cell';
import type { Editing } from './editing';
import { LinePicker } from './LinePicker';

const ADDITIONS: [keyof Rate['additions'], string][] = [['material', 'Material fluctuation'], ['labour', 'Labour fluctuation'], ['risk', 'Risk']];
const money = (value: number | null) => (value == null ? '—' : Math.round(value).toLocaleString('en-US'));

/** A work item's recipe: a quantity of each price (or of another work item), then the percentage additions, to its
 * rate. Quantities and percentages are typed over; a line is added from the card, or removed after asking. */
export function BuildUp({ rate, value, prices, items, edit }: { rate: Rate; value: number | null; prices: Prices; items: Items; edit: Editing }) {
  const { ask, dialog } = useConfirm();
  const lines = rate.lines.map((line) => lineOf(line, prices, items));
  const sum = (kind: Line['kind']) => lines.reduce((total, line) => (line.kind === kind && line.amount != null ? total + line.amount : total), 0);
  const base = { material: sum('MATERIAL'), labour: sum('LABOUR') };
  const added = {
    material: base.material * (rate.additions.material / 100),
    labour: base.labour * (rate.additions.labour / 100),
    risk: (base.material * (1 + rate.additions.material / 100) + base.labour * (1 + rate.additions.labour / 100) + sum('PLANT')) * (rate.additions.risk / 100),
  };
  const setLines = (next: Line[]) => edit.change(rate.id, { lines: next });
  return (
    <tr className="border-b border-line bg-paper/70">
      <td colSpan={7} className="px-[18px] py-3">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7b848e]">
              <th className="py-1.5 text-left">Resource</th><th className="w-20 text-right">Qty</th><th className="w-28 pl-4 text-left">Unit</th><th className="w-32 text-right">Price (₦)</th><th className="w-32 text-right">Cost (₦)</th><th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, at) => (
              <tr key={at} className="border-t border-line/70">
                <td className="py-1"><span className="mr-2 rounded-md bg-[#eceae4] px-2 py-0.5 text-[12px] text-[#59636e]">{KIND_LABEL[line.kind]}</span>{line.name}</td>
                <td className="text-right"><Cell value={num(line.qty, 4)} label="Quantity" number canEdit={edit.canEdit} onSave={(text) => { const qty = toNumber(text); if (qty != null) setLines(rate.lines.map((each, i) => (i === at ? { ...each, qty } : each))); }} /></td>
                <td className="pl-4">{line.unit}</td>
                <td className="text-right">{line.unitPrice == null ? <span className="text-danger">no price</span> : line.unitPrice.toLocaleString('en-US')}</td>
                <td className="text-right">{money(line.amount)}</td>
                <td className="text-right">
                  {edit.canEdit && (
                    <button title="Remove this line" className="text-[#9aa1a9] hover:text-danger"
                      onClick={() => ask({ title: `Remove ${line.name} from ${rate.code}?`, message: 'The rate is worked out again without it.', label: 'Remove', onConfirm: () => setLines(rate.lines.filter((_, i) => i !== at)) })}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {ADDITIONS.map(([key, label]) => (
              <tr key={key} className="border-t border-line/70 text-[#59636e]">
                <td className="py-1" colSpan={3}>{label}</td>
                <td className="text-right">
                  <span className="inline-flex items-center gap-1"><span className="w-16"><Cell value={String(rate.additions[key])} label={`${label} %`} number canEdit={edit.canEdit} onSave={(text) => edit.change(rate.id, { additions: { ...rate.additions, [key]: toNumber(text) ?? 0 } })} /></span>%</span>
                </td>
                <td className="text-right">{money(added[key])}</td>
                <td />
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="py-2 font-bold" colSpan={4}>Rate per {rate.unit}</td>
              <td className="text-right font-bold">{value == null ? 'blank' : value.toLocaleString('en-US')}</td>
              <td />
            </tr>
          </tbody>
        </table>
        {edit.canEdit && <LinePicker rate={rate} prices={prices} items={items} onAdd={(line) => setLines([...rate.lines, line])} />}
        {dialog}
      </td>
    </tr>
  );
}
