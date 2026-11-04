import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useMe } from '@/lib/store';
import { useProjects } from './useProjects';
import { ProjectCard } from './ProjectCard';
import { NewProject } from './NewProject';

export function Projects() {
  const { me } = useMe();
  const projects = useProjects();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const words = query.toLowerCase().trim();
  const shown = projects.filter((project) => `${project.name} ${project.client} ${project.location}`.toLowerCase().includes(words));
  return (
    <>
      <div className="flex flex-wrap items-center gap-3.5">
        <label className="relative w-full md:max-w-[405px]">
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
