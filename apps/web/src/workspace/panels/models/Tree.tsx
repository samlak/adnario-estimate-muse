import { useState } from 'react';
import { useWs } from '../../state';
import type { Element } from '../../viewer/types';
import { Hidden } from './types';
import { toggle } from './utils';
import { Node } from './TreeNode';

export function Tree({ elements, hidden, setHidden }: { elements: Element[]; hidden: Hidden; setHidden: (hidden: Hidden) => void }) {
  const ws = useWs();
  const [tab, setTab] = useState<'classes' | 'storeys'>('classes');
  const flip = (key: keyof Hidden, item: string) => setHidden({ ...hidden, [key]: toggle(hidden[key], item) });
  const models = ws.models.filter((model) => model.state === 'current');
  return (
    <div>
      <div className="grid grid-cols-2 border-b border-line">
        {(['classes', 'storeys'] as const).map((id) => (
          <button key={id} onClick={() => setTab(id)} className={`-mb-px h-[40px] border-b-2 text-[14px] capitalize ${tab === id ? 'border-primary font-semibold' : 'border-transparent text-[#6b7581]'}`}>{id}</button>
        ))}
      </div>
      <ul className="py-2.5">
        {models.map((model) => {
          const mine = elements.filter((element) => element.model === model.id);
          const groups = new Map<string, number>();
          for (const element of mine) {
            const key = tab === 'classes' ? element.cls : element.storey;
            groups.set(key, (groups.get(key) ?? 0) + 1);
          }
          const key = tab === 'classes' ? 'classes' : 'storeys';
          return (
            <Node key={model.id} label={model.name} level={0} open on={!hidden.models.includes(model.id)} onChange={() => flip('models', model.id)}>
              {[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => (
                <Node key={name} label={`${name || 'No storey'} (${count})`} level={1} on={!hidden[key].includes(`${model.id}:${name}`)} onChange={() => flip(key, `${model.id}:${name}`)} />
              ))}
            </Node>
          );
        })}
      </ul>
    </div>
  );
}
