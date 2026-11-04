import { Fragment } from 'react';
import { Conf } from '@/components/ui/Conf';
import { useWs, type Item, type Result } from '../../state';
import { HEX } from '../../viewer/constants';
import { Head } from './Head';
import { Section } from './Section';
import { bySection } from './bySection';
import { Edit } from './EditCell';
import { Inspector } from './Inspector';
import { AddLine } from './AddLine';
import { CommentButton } from '../../sheets/CommentButton';

export function BoqLines({ result }: { result: Result }) {
  const ws = useWs();
  const opened = result.boq.find((line) => line.code === ws.line);
  return (
    <>
      {opened && <Inspector line={opened} result={result} />}
      <table className="w-full text-[12px]">
        <Head cols={[['Item'], ['Description'], ['Qty', 'right'], ['Unit'], ws.money ? ['Rate', 'right'] : ['Confidence']]} />
        <tbody>
          {bySection(result.boq).map(([section, lines]) => (
            <Fragment key={section}>
              <Section name={section} span={5} />
              {lines.map((line) => (
                <tr key={line.code} id={`boq-${line.code}`} className={`group cursor-pointer border-b border-line align-top hover:bg-paper ${ws.line === line.code ? 'bg-primary-50' : ''}`} onClick={() => { ws.setLine(ws.line === line.code ? null : line.code); ws.show(line.gids); }}>
                  <td className="whitespace-nowrap py-1.5 pl-1.5 text-[#6b7581]"><i aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: HEX[line.confidence] }} title={`${line.confidence} confidence`} />{result.refs[line.code]}</td>
                  <td className="py-1.5 pr-2">{line.description}{line.source === 'provisional' && <small className="text-accent-600"> · provisional</small>}<CommentButton topic={{ kind: 'boq', ref: line.code, label: `${result.refs[line.code] ?? ''} ${line.description}`.trim() }} /></td>
                  <td className="py-1 text-right"><Edit line={line} field="qty" /></td>
                  <td className="py-1.5 pl-2">{line.unit}</td>
                  <td className="py-1 pl-1 text-right">{ws.money ? <Edit line={line} field="rate" /> : <Conf value={line.confidence} />}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      {ws.editor && <AddLine />}
    </>
  );
}
