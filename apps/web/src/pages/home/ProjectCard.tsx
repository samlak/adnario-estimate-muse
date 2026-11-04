import { Boxes, CircleHelp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ago } from '@/lib/format';
import { Project } from './types';

export function ProjectCard({ project }: { project: Project }) {
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
