import { Conf } from '@/components/ui/Conf';
import { useWs, type Result } from '../../state';
import { Head } from './Head';

export function Types({ result }: { result: Result }) {
  const ws = useWs();
  return (
    <table className="w-full text-[12.5px]">
      <Head cols={[['Key'], ['Type'], ['Nr', 'right'], ['Decision']]} />
      <tbody>
        {result.types.map((type) => (
          <tr key={type.key} className="cursor-pointer border-b border-line align-top hover:bg-paper" onClick={() => ws.show(type.gids)}>
            <td className="py-2 pl-1.5">{type.key}</td>
            <td className="py-2 pr-2">{type.class.replace(/^Ifc/, '')}<span className="block text-[#6b7581]">{[type.family ? `${type.family}:${type.type}` : type.type, type.size, type.model].filter(Boolean).join(' · ')}</span></td>
            <td className="py-2 pr-3 text-right">{type.count}</td>
            <td className="py-2">
              {type.mapping.decision === 'bill' ? type.mapping.items.map((item) => item.description).join('; ') : type.mapping.decision === 'exclude' ? 'Left out' : 'Not mapped'}
              {type.mapping.reason && <span className="block text-[#6b7581]">{type.mapping.reason}</span>}
              <span className="mt-1 inline-block">{type.mapping.decision === 'bill' ? <Conf value={type.mapping.confidence} /> : null}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
