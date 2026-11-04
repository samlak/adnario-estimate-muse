import { Fragment, useState } from 'react';
import { Conf } from '@/components/ui/Conf';
import { num } from '@/lib/format';
import { useWs, type Item, type Result } from '../../state';
import { Head } from './Head';
import { Section } from './Section';
import { bySection } from './bySection';

export function Measured({ result }: { result: Result }) {
  const ws = useWs();
  const [tab, setTab] = useState<'measured' | 'not'>('measured');
  const not = result.types.filter((type) => type.mapping.decision !== 'bill' || type.mapping.held);
  return (
    <>
      <div className="flex border-b border-line text-[12.5px]">
        <button onClick={() => setTab('measured')} className={`rounded-t-lg border px-3.5 py-1.5 ${tab === 'measured' ? '-mb-px border-line border-b-white bg-white font-semibold' : 'border-transparent text-[#59636e]'}`}>Measured <small className="text-[#9aa1a9]">{result.takeoff_lines.length}</small></button>
        <button onClick={() => setTab('not')} className={`rounded-t-lg border px-3.5 py-1.5 ${tab === 'not' ? '-mb-px border-line border-b-white bg-white font-semibold' : 'border-transparent text-[#59636e]'}`}>Not measured <small className="text-[#9aa1a9]">{not.length}</small></button>
      </div>
      {tab === 'measured' ? (
        <table className="mt-3 w-full text-[12.5px]">
          <Head cols={[['Item'], ['Qty', 'right'], ['Unit'], ['Confidence']]} />
          <tbody>
            {bySection(result.takeoff_lines).map(([section, lines]) => (
              <Fragment key={section}>
                <Section name={section} span={4} />
                {lines.map((line) => (
                  <tr key={line.code} className={`cursor-pointer border-b border-line align-top hover:bg-paper ${ws.line === line.code ? 'bg-primary-50' : ''}`} onClick={() => { ws.setLine(ws.line === line.code ? null : line.code); ws.show(line.gids); }}>
                    <td className="py-2 pl-1.5 pr-2">{line.description}{line.count > 0 && <small className="text-[11px] text-[#59636e]"> · {line.count} el.</small>}</td>
                    <td className="py-2 text-right">{line.qty == null ? '' : num(line.qty)}</td>
                    <td className="py-2 pl-2">{line.unit}</td>
                    <td className="py-2 pl-2"><Conf value={line.confidence} /></td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="mt-3 w-full text-[12.5px]">
          <Head cols={[['Type'], ['No.', 'right'], ['']]} />
          <tbody>
            {not.map((type) => (
              <tr key={type.key} className="cursor-pointer border-b border-line align-top hover:bg-paper" onClick={() => ws.show(type.gids)}>
                <td className="py-2 pl-1.5 pr-2">
                  <b className="font-semibold text-primary">{type.type}</b>
                  <p className="text-[11.5px] text-[#6b7581]">{type.mapping.held ? 'Held: ' : ''}{type.mapping.reason || 'not mapped'}</p>
                </td>
                <td className="py-2 text-right">{type.count}</td>
                <td className="py-2 pl-2 text-right">
                  <button className="btn-ghost h-[27px] whitespace-nowrap px-2.5 text-[12px]" disabled={!ws.editor} onClick={(event) => { event.stopPropagation(); void ws.edit({ op: 'type', code: type.key, decision: 'bill' }); }}>Add to takeoff</button>
                </td>
              </tr>
            ))}
          </tbody>
          {not.length === 0 && <caption className="caption-bottom py-6 text-[12.5px] text-[#6b7581]">Every type was measured.</caption>}
        </table>
      )}
    </>
  );
}
