/** Dashboard and Projects (README §6), the New project sheet, and the profile page. */
import { AtSign, Boxes, CircleHelp, FileBox, Plus, Search, Users, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Sheet } from '@/components/ui';
import { errorText } from '@/lib/api';
import { ago } from '@/lib/format';
import { reload, ROLE_NAME, send, useApi, useMe } from '@/lib/store';
import { readNotice, useNotices } from '@/pages/Shell';

export type Project = {
  id: string; name: string; client: string; location: string; description: string; updated_at: string;
  models: number; people: number; questions: number; takeoff: string | null; status: string | null;
};

/** The projects this person is on; an Admin sees all of the firm's (the server decides). */
export const useProjects = () => useApi<Project[]>('/projects').data ?? [];

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link to={`/projects/${project.id}`} className="card block px-[17px] pb-4 pt-[17px] transition-colors hover:border-primary-200">
      <div className="flex items-start gap-3">
        <h3 className="flex-1 text-[16.5px] font-bold tracking-[-0.01em]">{project.name}</h3>
        <small className="pt-1 text-[12px] text-[#9aa1a9]">{ago(project.updated_at)}</small>
      </div>
      <p className="mt-0.5 text-[13.5px] text-[#7b848e]">{[project.client, project.location].filter(Boolean).join(' · ')}</p>
      <div className="mt-3.5 flex items-center gap-2 text-[13.5px] text-[#4b5560]">
        {project.status === 'ready' ? (
          <>{project.takeoff} <span className="pill bg-success-50 text-success">Ready</span></>
        ) : project.status === 'running' ? (
          <>{project.takeoff} <span className="pill bg-accent-50 text-accent-600">Running</span></>
        ) : (
          <span className="pill bg-canvas text-[#6b7581]">No takeoff yet</span>
        )}
      </div>
      <div className="mt-3.5 flex gap-5 border-t border-line pt-3 text-[13px] text-[#6b7581]">
        <span className="flex items-center gap-1.5"><Boxes size={15} strokeWidth={1.6} /> {project.models}</span>
        <span className="flex items-center gap-1.5"><CircleHelp size={15} className="text-accent-500" /> {project.questions}</span>
        <span className="flex items-center gap-1.5"><Users size={15} strokeWidth={1.6} /> {project.people}</span>
      </div>
    </Link>
  );
}

export function Dashboard() {
  const { me, firm } = useMe();
  const projects = useProjects();
  const notices = useNotices().filter((notice) => !notice.read);
  const [creating, setCreating] = useState(false);
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return (
    <>
      <section className="relative overflow-hidden rounded-[26px] bg-[#13294a] px-[34px] pb-[22px] pt-[22px] text-white">
        <div className="absolute -right-24 -top-28 h-[360px] w-[360px] rounded-full bg-white/[0.06]" style={{ right: -120, top: -80, width: 360, height: 360 }} />
        <p className="relative text-[12.5px] font-bold tracking-[0.16em] text-accent">{ROLE_NAME[me.role].toUpperCase()}</p>
        <h2 className="relative mt-2 text-[31px] font-bold tracking-[-0.02em]">Good {part}, {me.name.split(' ')[0]}</h2>
        <p className="relative mt-1 text-[15px] text-white/80">{firm.name}</p>
      </section>
      <div className="mt-[26px] flex items-end justify-between">
        <h3 className="eyebrow">Recent projects</h3>
        {me.role !== 'viewer' && (
          <button className="btn-primary h-[33px] rounded-lg text-[14px]" onClick={() => setCreating(true)}>
            <Plus size={16} /> New project
          </button>
        )}
      </div>
      <div className="mt-3.5 grid gap-[14px] md:grid-cols-2 xl:grid-cols-3">
        {projects.slice(0, 6).map((project) => <ProjectCard key={project.id} project={project} />)}
      </div>
      {projects.length > 6 && <Link to="/projects" className="mt-3 inline-block text-sm font-semibold text-primary">All {projects.length} projects</Link>}
      <h3 className="eyebrow mt-[34px]">Needs your attention</h3>
      <div className="mt-3.5 grid gap-[14px] md:grid-cols-2 xl:grid-cols-3">
        {notices.length === 0 && <p className="text-sm text-[#6b7581]">Nothing is waiting for you.</p>}
        {notices.map((notice) => (
          <Link key={notice.id} to={notice.project_id ? `/projects/${notice.project_id}` : '/'} className="card flex gap-3 px-[17px] py-4" onClick={() => void readNotice(notice.id)}>
            <span className="grid h-[33px] w-[33px] shrink-0 place-items-center rounded-full bg-accent-50 text-accent-600"><AtSign size={17} /></span>
            <span className="min-w-0">
              <b className="block text-[14.5px] font-semibold">{notice.title}</b>
              <span className="mt-0.5 block truncate text-[13.5px] text-[#6b7581]">“{notice.text}</span>
              <small className="mt-1 block text-[12px] text-[#9aa1a9]">{ago(notice.created_at)}</small>
            </span>
          </Link>
        ))}
      </div>
      {creating && <NewProject onClose={() => setCreating(false)} />}
    </>
  );
}

export function Projects() {
  const { me } = useMe();
  const projects = useProjects();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const words = query.toLowerCase().trim();
  const shown = projects.filter((project) => `${project.name} ${project.client} ${project.location}`.toLowerCase().includes(words));
  return (
    <>
      <div className="flex items-center gap-3.5">
        <label className="relative w-full max-w-[405px]">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a929b]" />
          <input className="input h-[44px] pl-10" placeholder="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <span className="flex-1 text-[13.5px] text-[#7b848e]">
          {shown.length} of {projects.length} {me.role === 'admin' ? 'in the organisation' : 'you are on'}
        </span>
        {me.role !== 'viewer' && (
          <button className="btn-primary h-[33px] rounded-lg text-[14px]" onClick={() => setCreating(true)}><Plus size={16} /> New project</button>
        )}
      </div>
      <div className="mt-[18px] grid gap-[14px] md:grid-cols-2 xl:grid-cols-3">
        {shown.map((project) => <ProjectCard key={project.id} project={project} />)}
      </div>
      {creating && <NewProject onClose={() => setCreating(false)} />}
    </>
  );
}

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

export function Profile() {
  const { me, firm } = useMe();
  const [name, setName] = useState(me.name);
  return (
    <div className="card max-w-[608px] space-y-5 p-[21px]">
      <div className="flex items-center gap-3.5">
        <Avatar name={me.name} size={48} />
        <div><b className="block text-[17px]">{me.name}</b><span className="text-[13.5px] text-[#6b7581]">{ROLE_NAME[me.role]} · {firm.name}</span></div>
      </div>
      <label className="block"><span className="label">Name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="block"><span className="label">Email</span><input className="input bg-paper" value={me.email} readOnly /></label>
      <button className="btn-primary" disabled={!name.trim() || name === me.name} onClick={() => void send('/me', 'PATCH', { name: name.trim() }, '/me')}>Save</button>
    </div>
  );
}
