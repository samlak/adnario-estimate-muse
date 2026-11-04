import { Sheet } from '@/components/ui/Sheet';
import { stamp } from '@/lib/format';
import { useWs } from '../state';

export function Versions({ onClose }: { onClose: () => void }) {
  const ws = useWs();
  const STATE = { current: 'in use', proposed: 'proposed, waiting for a QS', rejected: 'rejected', superseded: 'superseded' };
  return (
    <Sheet title="Versions" onClose={onClose}>
      <div className="space-y-2 px-5 py-4 text-[13px]">
        <p className="text-[#6b7581]">A new export of a model becomes its next version. The server works out, element by element, what was added, removed or changed; a QS or Admin accepts or rejects it in the Models panel.</p>
        {ws.models.map((model) => (
          <div key={model.id} className="rounded-xl border border-line px-3 py-2.5">
            <b className="block font-semibold">{model.name}</b>
            <span className="text-[12px] text-[#6b7581]">Version {model.version} · {STATE[model.state]} · {stamp(model.created_at)}{model.state === 'rejected' && model.note ? ` · ${model.note}` : ''}</span>
            {model.changes && <span className="block text-[12px] text-[#59636e]">{model.changes.added} added · {model.changes.removed} removed · {model.changes.changed} changed</span>}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
