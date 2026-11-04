/** Dashboard and Projects, the New project sheet, and the profile page. */
import { AtSign, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ago } from '@/lib/format';
import { ROLE_NAME, useMe } from '@/lib/store';
import { readNotice, useNotices } from '@/pages/shell/notices';
import { useProjects } from './useProjects';
import { ProjectCard } from './ProjectCard';
import { NewProject } from './NewProject';

export function Dashboard() {
  const { me, firm } = useMe();
  const projects = useProjects();
  const notices = useNotices().filter((notice) => !notice.read);
  const [creating, setCreating] = useState(false);
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return (
    <>
      <section className="relative overflow-hidden rounded-[26px] bg-[#13294a] px-5 pb-[22px] pt-[22px] text-white md:px-[34px]">
        <div className="absolute -right-24 -top-28 h-[360px] w-[360px] rounded-full bg-white/[0.06]" style={{ right: -120, top: -80, width: 360, height: 360 }} />
        <p className="relative text-[12.5px] font-bold tracking-[0.16em] text-accent">{ROLE_NAME[me.role].toUpperCase()}</p>
        <h2 className="relative mt-2 text-[24px] font-bold md:text-[31px] tracking-[-0.02em]">Good {part}, {me.name.split(' ')[0]}</h2>
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
