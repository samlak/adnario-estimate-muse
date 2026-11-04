/** The Models panel (show or hide each model, nudge it into line, delete it, accept or reject a new version) and the
 * Tree panel (the models' elements by class and storey, to find and isolate them). */
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Confirm } from '@/components/ui/Confirm';
import { errorText } from '@/lib/api';
import { send } from '@/lib/store';
import { useWs, type Model } from '../../state';
import { Hidden } from './types';
import { toggle, size } from './utils';
import { Tick } from './Tick';

export function Models({ hidden, setHidden }: { hidden: Hidden; setHidden: (hidden: Hidden) => void }) {
  const ws = useWs();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const changed = `/projects/${ws.projectId}/models`;
  const act = (work: Promise<unknown>) => work.then(() => setError('')).catch((error) => setError(errorText(error)));
  const current = ws.models.filter((model) => model.state === 'current');
  const proposed = ws.models.filter((model) => model.state === 'proposed');
  const nudge = (model: Model, change: Partial<Model['nudge']>) => act(send(`/models/${model.id}/nudge`, 'PATCH', { ...model.nudge, ...change }, changed));
  return (
    <div className="px-[11px] pt-3">
      <h2 className="px-1 pb-2.5 text-[14.5px] font-bold">Models</h2>
      {error && <p className="mb-2 px-1 text-[12.5px] text-danger">{error}</p>}
      <div className="space-y-2">
        {current.map((model) => (
          <div key={model.id} className="rounded-xl border border-line px-2.5 py-2.5">
            <div className="flex items-center gap-2">
              <Tick on={!hidden.models.includes(model.id)} onChange={() => setHidden({ ...hidden, models: toggle(hidden.models, model.id) })} />
              <b className="flex-1 truncate text-[14px] font-semibold" title={model.name}>{model.name}</b>
              {ws.editor && <button title="Delete this model" onClick={() => setDeleting(model.id)}><Trash2 size={16} className="text-[#3b4652]" /></button>}
            </div>
            <p className="mt-1.5 text-[11.5px] text-[#6b7581]">
              {[`v${model.version}`, size(model.size), model.status === 'ready' ? (model.seconds ? `${model.seconds}s` : '') : model.status === 'converting' ? 'converting…' : 'could not convert',
                model.stats?.glass ? `${model.stats.glass} glass parts` : ''].filter(Boolean).join(' · ')}
            </p>
            {model.status === 'failed' && <p className="mt-1 text-[11.5px] text-danger">{model.note}</p>}
            <details className="mt-1 text-[11.5px] text-[#4b5560]">
              <summary className="cursor-pointer">Adjust position</summary>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {(['x', 'z', 'rotate'] as const).map((axis) => (
                  <label key={axis} className="block">
                    <span className="text-[10.5px] uppercase text-[#8a929b]">{axis === 'rotate' ? 'Rotate °' : `Shift ${axis} m`}</span>
                    <input type="number" step={axis === 'rotate' ? 1 : 0.1} defaultValue={model.nudge?.[axis] ?? 0} className="h-7 w-full rounded border border-line px-1.5" onBlur={(event) => nudge(model, { [axis]: Number(event.target.value) })} />
                  </label>
                ))}
              </div>
            </details>
          </div>
        ))}
        {proposed.map((model) => (
          <div key={model.id} className="rounded-xl border border-accent-200 bg-accent-50/40 px-2.5 py-2.5 text-[12px]">
            <b className="block truncate text-[13.5px]">{model.name} · v{model.version} proposed</b>
            {model.changes && <p className="mt-1 text-[#59636e]">{model.changes.added} added · {model.changes.removed} removed · {model.changes.changed} changed</p>}
            {ws.editor && (
              <div className="mt-2 flex gap-2">
                <button className="btn-primary h-[28px] px-2.5 text-[12px]" onClick={() => act(send(`/models/${model.id}/decision`, 'POST', { accept: true }, changed))}>Accept</button>
                <button className="btn-ghost h-[28px] px-2.5 text-[12px]" onClick={() => { const reason = prompt('Why is it rejected? The uploader sees this.'); if (reason != null) void act(send(`/models/${model.id}/decision`, 'POST', { accept: false, reason }, changed)); }}>Reject</button>
              </div>
            )}
          </div>
        ))}
        {ws.models.length === 0 && <p className="px-1 text-[13px] text-[#6b7581]">No models yet. Use Import IFC to add them.</p>}
      </div>
      {deleting && (
        <Confirm
          title="Delete this model?"
          message="It leaves the viewer. Versions an estimate measured are kept."
          onCancel={() => setDeleting(null)}
          onConfirm={() => { void act(send(`/models/${deleting}`, 'DELETE', undefined, changed)); setDeleting(null); }}
        />
      )}
    </div>
  );
}
