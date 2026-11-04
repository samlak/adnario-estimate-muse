/** The workspace's bar (README §7): back to projects, the project and its takeoff, the viewer's tools, versions,
 * people and comments, and the account. */
import { Box, Boxes, ChevronDown, ChevronLeft, Crosshair, Eraser, Eye, EyeOff, FileUp, History, MapPin, MessagesSquare, PanelsTopLeft, Plus, Ruler, Scissors, Square, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorText } from '@/lib/api';
import { send, useMe } from '@/lib/store';
import { AccountMenu } from '@/pages/shell/AccountMenu';
import { Bells } from '@/pages/shell/Bells';
import { NewProject } from '@/pages/home/NewProject';
import { useProjects } from '@/pages/home/useProjects';
import { Conversation } from '../sheets/Conversation';
import { People } from '../sheets/People';
import { Versions } from '../sheets/Versions';
import { DATA_PANELS, useWs, type Model } from '../state';
import type { ViewerHandle } from '../viewer/types';
import { Divider } from './Divider';
import { Tool } from './Tool';
import { Segment } from './Segment';

export function TopBar(props: {
  viewer: React.RefObject<ViewerHandle>;
  tool: 'cut' | 'measure' | null; setTool: (tool: 'cut' | 'measure' | null) => void;
  glass: boolean; setGlass: (on: boolean) => void;
  onSheet: (sheet: 'people' | 'conversation' | 'versions') => void;
}) {
  const ws = useWs();
  const navigate = useNavigate();
  const projects = useProjects();
  const [switching, setSwitching] = useState(false);
  const [creating, setCreating] = useState(false);
  const { me } = useMe();
  const v = props.viewer;
  const toggle = (tool: 'cut' | 'measure') => props.setTool(props.tool === tool ? null : tool);
  const dataPanel = ws.panel && DATA_PANELS.includes(ws.panel);
  const annotatable = !!ws.result || (ws.work?.kind === 'run' && !ws.work.done);
  return (
    <header className="flex h-[58px] shrink-0 items-center gap-[7px] border-b border-line px-2.5">
      <button className="tool" title="Back to projects" onClick={() => navigate('/projects')}><ChevronLeft size={18} /></button>
      <div className="relative">
        <button className="flex items-center gap-2 px-3 text-[15.5px] font-bold" onClick={() => setSwitching(!switching)}>
          {ws.projectName} <ChevronDown size={16} className="text-[#7b848e]" />
        </button>
        {switching && (
          <div className="absolute left-0 z-50 mt-2 w-64 rounded-xl border border-line bg-white py-1.5 shadow-pop">
            {projects.map((each) => (
              <button key={each.id} className={`block w-full px-4 py-2 text-left text-[14px] hover:bg-paper ${each.id === ws.projectId ? 'font-semibold' : ''}`} onClick={() => { setSwitching(false); navigate(`/projects/${each.id}`); }}>{each.name}</button>
            ))}
          </div>
        )}
      </div>
      <Divider />
      {me.role !== 'viewer' && (
        <label className="btn-primary h-[34px] cursor-pointer rounded-lg">
          <FileUp size={16} /> Import IFC
          <input type="file" accept=".ifc" multiple hidden onChange={(event) => {
            const body = new FormData();
            [...(event.target.files ?? [])].forEach((file) => body.append('files', file));
            event.target.value = '';
            void send(`/projects/${ws.projectId}/models`, 'POST', body, `/projects/${ws.projectId}/models`).catch((error) => alert(errorText(error)));
          }} />
        </label>
      )}
      <Divider />
      <Tool title="Fit view" onClick={() => v.current?.fit()}><Crosshair size={17} /></Tool>
      <Tool title="See-through glass" on={props.glass} onClick={() => props.setGlass(!props.glass)}><PanelsTopLeft size={17} /></Tool>
      <Tool title="Section cut: click a surface" on={props.tool === 'cut'} onClick={() => toggle('cut')}><Scissors size={17} /></Tool>
      <Tool title="Measure distance: click two points" on={props.tool === 'measure'} onClick={() => toggle('measure')}><Ruler size={17} /></Tool>
      <Tool title="Remove cuts and measurements" onClick={() => { v.current?.erase(); props.setTool(null); }}><Eraser size={17} /></Tool>
      <Divider />
      <Tool title="Hide selected" onClick={() => v.current?.hideSelected()}><EyeOff size={17} /></Tool>
      <Tool title="Show all" onClick={() => v.current?.showAll()}><Eye size={17} /></Tool>
      <Divider />
      <div className="flex overflow-hidden rounded-lg border border-line">
        <Segment title="Original: the model as designed" on={ws.view === 'original'} onClick={() => ws.setView('original')}><Box size={17} /></Segment>
        <Segment title="Skeleton: every element as an outline" on={ws.view === 'skeleton'} onClick={() => ws.setView('skeleton')}><Square size={17} /></Segment>
        <Segment title={annotatable ? 'Annotated: the takeoff on the model' : 'Annotated: run the takeoff first'} disabled={!annotatable} on={ws.view === 'annotated'} onClick={() => ws.setView('annotated')}><MapPin size={17} /></Segment>
      </div>
      <span className="flex-1" />
      {dataPanel && (
        <button
          className={`btn h-[30px] rounded-lg border px-3 text-[13.5px] font-medium ${ws.full ? 'border-line text-ink' : 'border-primary-300 bg-primary-50 text-ink'}`}
          onClick={() => ws.setFull(!ws.full)}
          title={ws.full ? 'Bring the model back' : 'Give the table the whole width'}
        >
          <Boxes size={15} /> Model
        </button>
      )}
      <button className="grid h-9 w-9 place-items-center text-[#59636e]" title="Versions" onClick={() => props.onSheet('versions')}><History size={18} /></button>
      {me.role !== 'viewer' && <button className="btn-primary h-[34px] w-[34px] rounded-lg px-0" title="New project" onClick={() => setCreating(true)}><Plus size={18} /></button>}
      {creating && <NewProject onClose={() => setCreating(false)} />}
      <Divider />
      <button className="grid h-9 w-9 place-items-center text-[#3b4652]" title="Conversation" onClick={() => props.onSheet('conversation')}><MessagesSquare size={18} /></button>
      <button className="grid h-9 w-9 place-items-center text-[#3b4652]" title="People" onClick={() => props.onSheet('people')}><Users size={18} /></button>
      <Divider />
      <Bells compact />
      <AccountMenu compact />
    </header>
  );
}
