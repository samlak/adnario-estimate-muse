import { Settings } from 'lucide-react';
import { useWs } from '../state';

/** The project's name opens this: who it is for, where, what, its models, and its versions and settings. */
export function ProjectMenu({ onSheet }: { onSheet: (sheet: 'versions' | 'settings') => void }) {
  const { project, models } = useWs();
  const current = models.filter((model) => model.state === 'current');
  return (
    <div className="absolute left-0 z-50 mt-2 w-[340px] rounded-2xl border border-line bg-white p-4 shadow-pop">
      <h3 className="text-[17px] font-bold">{project.name}</h3>
      {(project.client || project.location) && <p className="mt-0.5 text-[13.5px] text-[#6b7581]">{[project.client, project.location].filter(Boolean).join(' · ')}</p>}
      {project.description && <p className="mt-2 text-[13.5px] leading-[1.5]">{project.description}</p>}
      <p className="mt-4 border-b border-line pb-1.5 text-[11px] font-semibold tracking-[0.1em] text-[#9aa1a9]">MODELS</p>
      <ul className="py-1">
        {current.map((model) => <li key={model.id} className="flex items-baseline py-1 text-[13.5px] font-semibold"><span className="flex-1 truncate">{model.name.replace(/\.ifc$/i, '')}</span><small className="text-[11.5px] text-[#7b848e]">v{model.version}</small></li>)}
        {current.length === 0 && <li className="py-1 text-[13px] text-[#6b7581]">No models yet.</li>}
      </ul>
      <div className="mt-3 flex gap-2">
        <button className="btn-ghost h-[32px] rounded-lg px-3 text-[13px] font-medium" onClick={() => onSheet('versions')}>Model versions</button>
        {project.editor && <button className="btn-ghost h-[32px] rounded-lg px-3 text-[13px] font-medium" onClick={() => onSheet('settings')}><Settings size={15} /> Settings</button>}
      </div>
    </div>
  );
}
