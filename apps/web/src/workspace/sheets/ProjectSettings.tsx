import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '@/components/ui/Sheet';
import { useConfirm } from '@/components/ui/useConfirm';
import { errorText } from '@/lib/api';
import { reload, send, useMe } from '@/lib/store';
import type { Project } from '../state';

/** The project's name, client, location and description; and deleting it, for who may. */
export function ProjectSettings({ project, onClose }: { project: Project; onClose: () => void }) {
  const navigate = useNavigate();
  const { permissions } = useMe();
  const { ask, dialog } = useConfirm();
  const [form, setForm] = useState({ name: project.name, client: project.client, location: project.location, description: project.description });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const act = async (run: () => Promise<unknown>, after: () => void) => {
    setBusy(true);
    setError('');
    try {
      await run();
      after();
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  };
  const save = () => act(() => send(`/projects/${project.id}`, 'PATCH', { ...form, name: form.name.trim() }, '/projects'), onClose);
  const remove = () => act(() => send(`/projects/${project.id}`, 'DELETE'), () => { reload('/projects'); navigate('/projects'); });
  const field = (key: keyof typeof form, label: string) => (
    <label className="block">
      <span className="label">{label}</span>
      {key === 'description'
        ? <textarea className="input h-[110px] resize-y py-3" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
        : <input className="input h-[44px]" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}
    </label>
  );
  return (
    <Sheet
      title="Project settings"
      width={424}
      onClose={onClose}
      footer={
        <>
          {permissions.includes('delete_project') && (
            <button className="mr-auto text-[#7b848e] hover:text-danger" title="Delete this project" disabled={busy}
              onClick={() => ask({ title: `Delete ${project.name}?`, message: 'Its models, estimate, programme and comments are deleted, for everyone on it. This cannot be undone.', onConfirm: () => void remove() })}>
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn-ghost h-[37px] px-4 text-[14.5px]" onClick={onClose}>Cancel</button>
          <button className="btn-primary h-[37px] px-4 text-[14.5px]" disabled={!form.name.trim() || busy} onClick={() => void save()}>Save</button>
        </>
      }
    >
      <div className="space-y-[21px] px-5 py-5">
        {error && <p className="text-sm text-danger">{error}</p>}
        {field('name', 'Name')}
        {field('client', 'Client')}
        {field('location', 'Location')}
        {field('description', 'Description')}
      </div>
      {dialog}
    </Sheet>
  );
}
