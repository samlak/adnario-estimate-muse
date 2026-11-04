/** The properties of the element clicked in the model: what it is, its quantities, where it is in the
 * BOQ, and its comments. */
import { ChevronDown, ChevronUp, MessageSquare, X } from 'lucide-react';
import { Conf } from '@/components/ui/Conf';
import { parse } from '@/lib/calendar';
import { day as dayName, num } from '@/lib/format';
import { useMemo, useState } from 'react';
import { useApi } from '@/lib/store';
import { useComments } from './sheets/useComments';
import { useWs, type Model } from './state';
import { type Element } from './viewer/types';

/** Clicking an element shows its properties over the model: where it is in the BOQ (each item, its quantity from
 * this element and how it was measured), its IFC data and property sets, and a comment on it. */
export function Properties({ element, onClose }: { element: Element; onClose: () => void }) {
  const ws = useWs();
  const gid = element.id.split('#')[1];
  const { data } = useApi<{ type: string | null; material: string[]; psets: Record<string, Record<string, unknown>> }>(`/models/${element.model}/elements/${encodeURIComponent(gid)}`);
  const [folded, setFolded] = useState(false);
  const result = ws.result;
  const said = useComments().count('element', element.id);
  // the takeoff rows measured from this element, under the BOQ item each went into
  const inBoq = useMemo(() => {
    if (!result) return [];
    const rows = result.takeoff.filter((row) => row.ref === element.id && row.qty);
    return rows.map((row) => {
      const item = result.boq.find((each) => row.code && each.lines.includes(row.code)) ?? result.takeoff_lines.find((each) => each.code === row.code);
      return { code: item?.code ?? row.code ?? '', ref: item ? result.refs[item.code] ?? '' : '', description: item?.description ?? row.description, confidence: item?.confidence, qty: row.qty, unit: row.unit, source: row.source };
    });
  }, [result, element.id]);
  const parent = data?.type ?? element.storey;
  const building = (ws.plan?.leaves ?? []).filter((activity) => activity.refs.includes(element.id));
  const topic = { kind: 'element' as const, ref: element.id, label: `${element.cls.replace(/^Ifc/, '')} · ${element.name}` };
  return (
    <aside className="thin-scroll absolute right-3 top-3 z-20 max-h-[75%] w-[320px] overflow-y-auto overscroll-contain rounded-xl border border-line bg-white shadow-pop">
      <header className="sticky top-0 flex items-center gap-2 bg-white px-3.5 py-2.5">
        <b className="flex-1 text-[13.5px]">Properties</b>
        <button title={folded ? 'Open' : 'Fold'} onClick={() => setFolded(!folded)}>{folded ? <ChevronDown size={15} className="text-[#7b848e]" /> : <ChevronUp size={15} className="text-[#7b848e]" />}</button>
        <button className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-semibold text-primary hover:bg-primary-100" title="Comment on this element" onClick={() => ws.discuss(topic)}><MessageSquare size={13} /> Comment{said > 0 && ` ${said}`}</button>
        <button onClick={onClose} title="Close"><X size={16} className="text-[#7b848e]" /></button>
      </header>
      {!folded && (
        <div className="px-3.5 pb-3 text-[12.5px]">
          {inBoq.length > 0 && (
            <section className="mb-2.5 rounded-lg bg-[#f1f5f9] px-2.5 py-2">
              <p className="text-[10.5px] font-semibold tracking-[0.1em] text-[#6b7581]">{result?.boq.length ? 'IN THE BOQ' : 'IN THE TAKEOFF'}</p>
              {inBoq.map((row, at) => (
                <button key={at} className="mt-1.5 block w-full text-left" onClick={() => { ws.open('takeoff'); ws.setBoqTab(result?.boq.length ? 'boq' : 'takeoff'); ws.setLine(row.code); }}>
                  <span className="leading-[1.45]"><b>{row.ref}</b> {row.description} {row.confidence && <Conf value={row.confidence} />}</span>
                  <small className="block text-[11.5px] text-[#6b7581]">{num(row.qty)} {row.unit}{row.source ? ` · ${row.source}` : ''}</small>
                </button>
              ))}
            </section>
          )}
          {building.length > 0 && (
            <section className="mb-2.5 rounded-lg bg-[#f1f5f9] px-2.5 py-2">
              <p className="text-[10.5px] font-semibold tracking-[0.1em] text-[#6b7581]">IN THE PROGRAMME</p>
              {building.map((activity) => (
                <button key={activity.id} className="mt-1.5 block w-full text-left" onClick={() => { ws.open('programme'); ws.setActivity(activity.id); ws.setDay(activity.start); }}>
                  <b className="font-semibold text-primary">{activity.id} {activity.name}</b>
                  <small className="block text-[11.5px] text-[#6b7581]">{dayName(parse(activity.startDate))} – {dayName(parse(activity.finishDate))}{activity.critical ? ' · critical' : ''}</small>
                </button>
              ))}
            </section>
          )}
          <dl>
            {([['Class', element.cls], ['Name', element.name], ['GlobalId', gid], ['Inside', parent], ['Model', ws.models.find((model) => model.id === element.model)?.name ?? ''], ['Material', data?.material.join(', ') ?? '']] as [string, string][])
              .filter(([, value]) => value).map(([name, value]) => (
                <div key={name} className="grid grid-cols-[88px_1fr] gap-2 py-1"><dt className="text-[#6b7581]">{name}</dt><dd className="break-words">{value}</dd></div>
              ))}
          </dl>
          {data && Object.keys(data.psets).length === 0 && <p className="mt-1.5 text-[#6b7581]">No property sets on this element.</p>}
          {data && Object.entries(data.psets).map(([name, values]) => (
            <details key={name} className="border-t border-line py-1.5">
              <summary className="cursor-pointer font-semibold">{name}</summary>
              <dl className="mt-1">{Object.entries(values).filter(([key]) => key !== 'id').map(([key, value]) => <div key={key} className="grid grid-cols-[110px_1fr] gap-2 py-0.5 text-[12px]"><dt className="truncate text-[#6b7581]" title={key}>{key}</dt><dd className="break-words">{String(value)}</dd></div>)}</dl>
            </details>
          ))}
        </div>
      )}
    </aside>
  );
}
