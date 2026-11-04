/** The project workspace (README §7): the bar, the rail, the side panel, the 3D model, the properties of the clicked
 * element, the programme's dock, and Adnario AI at the bottom right. */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { NotFound } from '@/pages/not-found/NotFound';
import { can, put, reload, send, useApi, useMe } from '@/lib/store';
import { RAIL } from './constants';
import { hiddenTest, looksOf, marksOf } from './model';
import type { Hidden } from './panels/models/types';
import { Dock } from './panels/programme/Dock';
import { Readout } from './panels/programme/Readout';
import { Properties } from './Properties';
import { Rail } from './Rail';
import { Conversation } from './sheets/Conversation';
import { People } from './sheets/People';
import { ProjectSettings } from './sheets/ProjectSettings';
import { Versions } from './sheets/Versions';
import { SidePanel } from './SidePanel';
import { Sidekick } from './sidekick/Sidekick';
import './sidekick/sidekick.css';
import { DATA_PANELS, dayOfWeek, planOf, WsContext, type Card, type Estimate, type Model, type Panel, type Project, type Topic, type Ws } from './state';
import { TopBar } from './top-bar/TopBar';
import { useLiveUpdates } from './useLiveUpdates';
import { useNoPageZoom } from './useNoPageZoom';
import { useRemembered } from './useRemembered';
import { useWork } from './useWork';
import { Viewer } from './viewer/Viewer';
import { type Element, type View, type ViewerHandle } from './viewer/types';

export function Workspace() {
  const { id = '' } = useParams();
  const { me } = useMe();
  const { data: project, error: missing } = useApi<Project>(`/projects/${id}`);
  const models = useApi<Model[]>(`/projects/${id}/models`).data ?? [];
  const estimate = useApi<Estimate>(`/projects/${id}/estimate`).data;
  const rights = can(me.role);

  const [panel, open] = useRemembered<Panel | null>(`ws:${id}:open`, 'takeoff'); // a project opens on its takeoff
  const [full, setFull] = useState(false);
  const [day, setDay] = useRemembered(`ws:${id}:day`, 0);
  const [boqTab, setBoqTab] = useState('takeoff');
  const [line, setLine] = useState<string | null>(null);
  const [activity, setActivity] = useState<number | null>(null);
  const [picked, setPicked] = useState<Element | null>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [sheet, setSheet] = useState<'people' | 'conversation' | 'versions' | 'settings' | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null); // the conversation shows this thing's thread, or the whole project's
  const [tool, setTool] = useState<'cut' | 'measure' | null>(null);
  const [glass, setGlass] = useState(true);
  const [chosenView, setView] = useState<View | null>(null); // null: Annotated once there is a takeoff, else Original
  const [labels, setLabels] = useState(true);
  const [outline, setOutline] = useState(true);
  const [roofOff, setRoofOff] = useState(false);
  const [hidden, setHidden] = useState<Hidden>({ models: [], classes: [], storeys: [] });
  const viewer = useRef<ViewerHandle>(null);

  const refresh = useCallback(() => reload(`/projects/${id}`, '/projects'), [id]);
  useNoPageZoom();
  useLiveUpdates(id, refresh);
  const onRun = useCallback(() => { setView(null); open('takeoff'); }, [open]);
  const { work, follow } = useWork(estimate, refresh, onRun);

  const result = estimate?.result ?? null;
  const plan = useMemo(() => planOf(estimate?.programme ?? null), [estimate?.programme]);
  // what colours the model: each element's confidence (its type's), and the dates of the activity that builds it
  const live = work?.kind === 'run' && !work.done ? work : null;
  const looks = useMemo(() => looksOf(result, plan, live), [result, plan, live?.decided, live?.catalogue]);

  const comments = useApi<{ id: string; on_kind: string; on_ref: string | null; on_label: string }[]>(`/projects/${id}/comments`).data ?? [];
  const view: View = chosenView ?? (result || live ? 'annotated' : 'original');
  // what is drawn on the model: the run's newest decisions numbered, or a dot per BOQ item; comment pins on elements
  const marks = useMemo(() => marksOf(live, labels, result, view, comments), [live?.feed, labels, result, view, comments]);
  const isHidden = useMemo(() => hiddenTest(hidden), [hidden]);

  if (missing) return <NotFound />;
  if (!project) return null;

  const editor = project.editor;
  const rail = RAIL.filter((item) => rights.seeMoney || !item.money);
  const shown = panel && rail.some((item) => item.id === panel) ? panel : null;
  const ws: Ws = {
    project, projectId: project.id, projectName: project.name, models, estimate, result, plan,
    money: rights.seeMoney, editor, seeRates: rights.seeRateCards,
    panel: shown, open: (next) => { open(next); if (!next || !DATA_PANELS.includes(next)) setFull(false); },
    full, setFull, day: plan ? Math.min(day, plan.days.length - 1) : 0, setDay, boqTab, setBoqTab, line, setLine, activity, setActivity,
    // from the full view: back to the model first, then to the elements once it is drawn again
    show: (refs, fly) => { if (full) { setFull(false); setTimeout(() => viewer.current?.select(refs, fly), 80); } else viewer.current?.select(refs, fly); },
    view, setView, labels, setLabels,
    edit: async (change) => {
      if (!estimate) return;
      const next = await send<Estimate>(`/estimates/${estimate.id}/edit`, 'POST', change);
      put(`/projects/${id}/estimate`, next);
    },
    editProgramme: async (change) => {
      if (!estimate) return;
      await send(`/estimates/${estimate.id}/programme`, 'PATCH', change, `/projects/${id}/estimate`);
    },
    discuss: (next) => { setTopic(next); setSheet('conversation'); },
    work,
    start: (kind, body) => {
      if (!estimate) return;
      const path = kind === 'run' && estimate.status === 'ready' ? `/projects/${project.id}/revisions` : `/estimates/${estimate.id}/${kind}`;
      follow(kind, path, body);
    },
    refresh,
  };
  const fourD = shown === 'programme' && !!plan;
  const programmeFull = fourD && full;

  const links = {
    element: (ref: string) => viewer.current?.select(ref),
    week: (week: number) => { if (plan) ws.setDay(dayOfWeek(plan, week)); ws.open('programme'); },
    line: (code: string) => { ws.open('takeoff'); setBoqTab('boq'); setLine(result ? (Object.entries(result.refs).find(([, ref]) => ref === code)?.[0] ?? code) : code); },
    activity: (code: string) => { ws.open('programme'); setActivity(Number(code)); },
    panel: (name: string) => ws.open((name === 'estimate' ? 'takeoff' : name) as Panel),
  };

  return (
    <WsContext.Provider value={ws}>
      <div className="flex h-full flex-col overflow-clip bg-white">
        <TopBar
          viewer={viewer}
          tool={tool} setTool={setTool} glass={glass} setGlass={setGlass}
          onSheet={(next) => { setTopic(null); setSheet(next); }}
        />
        <div className="flex min-h-0 flex-1">
          <Rail items={rail} shown={shown} open={ws.open} />
          {shown && !programmeFull && <SidePanel shown={shown} full={full} hidden={hidden} setHidden={setHidden} elements={elements} />}
          <div className={`relative flex min-w-0 flex-1 flex-col ${full && !programmeFull ? 'hidden' : ''}`}>
            <div className={`relative min-h-0 flex-1 overflow-clip ${programmeFull ? 'hidden' : ''}`}>
              <Viewer
                ref={viewer}
                models={models}
                hidden={isHidden}
                view={view}
                looks={looks}
                mode={fourD ? '4d' : 'confidence'}
                date={plan ? plan.dayIso[ws.day] : undefined}
                outline={outline}
                roofOff={roofOff}
                glass={glass}
                tool={tool}
                marks={fourD ? [] : marks}
                open={line ? line : null}
                onMark={(key) => {
                  if (key.startsWith('pin:')) { const ref = key.slice(4); ws.discuss({ kind: 'element', ref, label: comments.find((each) => each.on_ref === ref)?.on_label ?? 'An element' }); return; }
                  if (key.startsWith('card:')) { const card = live?.feed.find((each) => 'key' in each && `card:${each.key}` === key) as Card | undefined; if (card) viewer.current?.select(card.gids, false); return; }
                  const item = result && [...result.boq, ...result.takeoff_lines].find((each) => each.code === key);
                  setLine(line === key ? null : key);
                  if (item && line !== key) viewer.current?.select(item.gids, false);
                }}
                onPick={setPicked}
                onElements={setElements}
              />
              {fourD && <Readout />}
              {picked && !full && <Properties element={picked} onClose={() => { setPicked(null); viewer.current?.select(null); }} />}
            </div>
            {fourD && <Dock outline={outline} setOutline={setOutline} roofOff={roofOff} setRoofOff={setRoofOff} canvas={() => viewer.current?.canvas() ?? null} fit={() => viewer.current?.fit(true)} />}
          </div>
        </div>
        {estimate?.result && <Sidekick estimateId={estimate.id} projectId={project.id} projectName={project.name} links={links} />}
        {sheet === 'people' && <People project={project} onClose={() => setSheet(null)} />}
        {sheet === 'conversation' && <Conversation project={project} topic={topic} onClose={() => { setSheet(null); setTopic(null); }} />}
        {sheet === 'versions' && <Versions onClose={() => setSheet(null)} />}
        {sheet === 'settings' && <ProjectSettings project={project} onClose={() => setSheet(null)} />}
      </div>
    </WsContext.Provider>
  );
}

