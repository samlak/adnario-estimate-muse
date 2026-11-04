import { FileBox, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '@/components/ui/Sheet';
import { errorText } from '@/lib/api';
import { reload, send } from '@/lib/store';

export function NewProject({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', client: '', location: '', description: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const add = (list: FileList | null) => {
    const ifc = [...(list ?? [])].filter((file) => /\.ifc$/i.test(file.name) && file.size <= 200 * 1024 * 1024);
    setFiles((now) => [...now, ...ifc]);
  };
  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const project = await send<{ id: string }>('/projects', 'POST', { ...form, name: form.name.trim() });
      if (files.length) {
        const body = new FormData();
        files.forEach((file) => body.append('files', file));
        await send(`/projects/${project.id}/models`, 'POST', body);
      }
      reload('/projects');
      navigate(`/projects/${project.id}`);
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  };
  const text = (key: keyof typeof form, label: string, placeholder = '') => (
    <label className="block">
      <span className="label">{label}</span>
      {key === 'description' ? (
        <textarea className="input h-[86px] resize-y py-3" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
      ) : (
        <input className="input h-[44px]" placeholder={placeholder} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
      )}
    </label>
  );
  return (
    <Sheet
      title="New project"
      width={424}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost h-[37px] px-4 text-[14.5px]" onClick={onClose}>Cancel</button>
          <button className="btn-primary h-[37px] px-4 text-[14.5px]" disabled={!form.name.trim() || busy} onClick={create}>{busy ? 'Creating…' : 'Create project'}</button>
        </>
      }
    >
      <div className="space-y-[21px] px-5 py-5">
        {error && <p className="text-sm text-danger">{error}</p>}
        {text('name', 'Name', 'Office block, Lekki')}
        {text('client', 'Client')}
        {text('location', 'Location', 'Lekki, Lagos')}
        {text('description', 'Description')}
        <div>
          <span className="label">Models</span>
          <button
            type="button"
            className={`flex w-full items-center gap-4 rounded-xl border border-dashed px-4 py-4 text-left text-[13.5px] leading-[1.45] text-[#59636e] ${over ? 'border-primary-400 bg-primary-50' : 'border-primary-300 bg-paper'}`}
            onClick={() => input.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => { event.preventDefault(); setOver(false); add(event.dataTransfer.files); }}
          >
            <FileBox size={22} className="shrink-0 text-primary" strokeWidth={1.6} />
            <span><b className="font-semibold text-primary">Choose or drop IFC files</b>: every discipline you have (architecture, structure, MEP). You can add more later.</span>
          </button>
          <input ref={input} type="file" accept=".ifc" multiple hidden onChange={(event) => add(event.target.files)} />
          <ul className="mt-2.5 space-y-1.5">
            {files.map((file, index) => (
              <li key={index} className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2 text-[13.5px] font-medium">
                <span className="flex-1 truncate">{file.name}</span>
                <span className="font-mono text-[12px] text-[#7b848e]">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                <button onClick={() => setFiles(files.filter((_, at) => at !== index))} title="Remove"><X size={15} className="text-[#7b848e]" /></button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Sheet>
  );
}
