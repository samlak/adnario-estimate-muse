/** The project workspace (README §7): the bar, the rail, the side panel, the 3D model, the properties of the clicked
 * element, the programme's dock, and Adnario AI at the bottom right. */
import {
  Banknote, Box, Boxes, CalendarDays, ChevronDown, ChevronLeft, Crosshair, Eraser, Eye, EyeOff, FileUp, History,
  ChevronUp, LineChart, ListTree, MapPin, MessageSquare, MessagesSquare, PanelsTopLeft, Plus, Ruler, Scissors, Square, Users, X,
} from 'lucide-react';
import { Conf } from '@/components/ui';
import { parse } from '@/lib/calendar';
import { day as dayName, num } from '@/lib/format';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorText } from '@/lib/api';
import { can, put, reload, send, useApi, useMe } from '@/lib/store';
import { AccountMenu, Bells } from '@/pages/Shell';
import { NewProject, useProjects } from '@/pages/Home';
import { CashFlow } from './panels/CashFlow';
import { Cost } from './panels/Cost';
import { Models, Tree, type Hidden } from './panels/Models';
import { Dock, ProgrammeList, Readout } from './panels/Programme';
import { Takeoff } from './panels/Takeoff';
import { Conversation, People, Versions } from './Sheets';
import { Sidekick } from './sidekick/Sidekick';
import './sidekick/sidekick.css';
import { dayOfWeek, planOf, useWs, WsContext, type Card, type Estimate, type Model, type Panel, type Project, type Work, type Ws } from './state';
import { streamRun } from './sidekick/stream';
import { HEX, Viewer, type Element, type Look, type Mark, type View, type ViewerHandle } from './Viewer';

const WIDTH: Record<Panel, number> = { models: 285, tree: 313, takeoff: 475, cost: 360, programme: 405, cashflow: 447 };
const RAIL: { id: Panel; icon: typeof Boxes; label: string; money?: boolean }[] = [
  { id: 'models', icon: Boxes, label: 'Models' },
  { id: 'tree', icon: ListTree, label: 'Tree' },
  { id: 'takeoff', icon: Ruler, label: 'Takeoff', money: true },
  { id: 'cost', icon: Banknote, label: 'Cost', money: true },
  { id: 'programme', icon: CalendarDays, label: 'Programme' },
  { id: 'cashflow', icon: LineChart, label: 'Cash flow', money: true },
];
const DATA_PANELS: Panel[] = ['takeoff', 'cost', 'programme', 'cashflow'];

/** Kept in the browser: the panel open and the player's day (README §7). */
function remembered<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved == null ? fallback : JSON.parse(saved);
    } catch {
      return fallback;
    }
  });
  const keep = useCallback((next: T) => {
    setValue(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* not kept */ }
  }, [key]);
  return [value, keep];
}

export function Workspace() {
  const { id = '' } = useParams();
  const { me } = useMe();
  const { data: project, error: missing } = useApi<Project>(`/projects/${id}`);
  const models = useApi<Model[]>(`/projects/${id}/models`).data ?? [];
  const estimate = useApi<Estimate>(`/projects/${id}/estimate`).data;
  const rights = can(me.role);

  const [panel, open] = remembered<Panel | null>(`ws:${id}:open`, 'takeoff'); // a project opens on its takeoff
  const [full, setFull] = useState(false);
  const [day, setDay] = remembered(`ws:${id}:day`, 0);
  const [boqTab, setBoqTab] = useState('takeoff');
  const [line, setLine] = useState<string | null>(null);
  const [activity, setActivity] = useState<number | null>(null);
  const [picked, setPicked] = useState<Element | null>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [sheet, setSheet] = useState<'people' | 'conversation' | 'versions' | null>(null);
  const [tool, setTool] = useState<'cut' | 'measure' | null>(null);
  const [glass, setGlass] = useState(true);
  const [chosenView, setView] = useState<View | null>(null); // null: Annotated once there is a takeoff, else Original
  const [labels, setLabels] = useState(true);
  const [outline, setOutline] = useState(true);
  const [roofOff, setRoofOff] = useState(false);
  const [hidden, setHidden] = useState<Hidden>({ models: [], classes: [], storeys: [] });
  const [work, setWork] = useState<Work | null>(null);
  const viewer = useRef<ViewerHandle>(null);

  const refresh = useCallback(() => reload(`/projects/${id}`, '/projects'), [id]);
  // a pinch anywhere in the workspace never zooms the page: over the model it zooms the model (Viewer)
  useEffect(() => {
    const wheel = (event: WheelEvent) => { if (event.ctrlKey) event.preventDefault(); };
    const gesture = (event: Event) => event.preventDefault();
    document.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('gesturestart', gesture);
    return () => { document.removeEventListener('wheel', wheel); document.removeEventListener('gesturestart', gesture); };
  }, []);
  // every change on the project (a model converted, an estimate saved, a comment) is told over the live stream
  useEffect(() => {
    const source = new EventSource(`/api/v1/projects/${id}/live`);
    let timer: ReturnType<typeof setTimeout>;
    source.addEventListener('change', () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 400);
    });
    return () => { source.close(); clearTimeout(timer); };
  }, [id, refresh]);

  const follow = useCallback((kind: Work['kind'], path: string, body?: FormData, method: 'POST' | 'GET' = 'POST') => {
    setWork({ kind, stages: [], done: false, mapped: 0, started: Date.now(), feed: [], decided: {}, file: body instanceof FormData ? (body.get('file') as File | null)?.name : undefined });
    if (kind === 'run') { setView(null); open('takeoff'); }
    const update = (change: (now: Work) => Work) => setWork((now) => (now && now.kind === kind ? change(now) : now));
    streamRun(path, body, (event, data) => {
      const given = data as Record<string, unknown>;
      if (event === 'stage') update((now) => {
        const stages = now.stages.filter((stage) => stage.name !== given.name);
        return { ...now, stages: [...stages, given as Work['stages'][number]] };
      });
      else if (event === 'mapped') update((now) => {
        const cards = (given.cards as Card[] | undefined) ?? [];
        const decided = { ...now.decided, ...(given.confidence as Record<string, Card['confidence']>) };
        for (const card of cards) decided[card.key] = card.confidence;
        return { ...now, mapped: Object.keys(decided).length, decided, feed: [...[...cards].reverse(), ...now.feed] };
      });
      else if (event === 'log') update((now) => ({ ...now, feed: [{ text: String(given.text) }, ...now.feed] }));
      else if (event === 'seen') update((now) => ({ ...now, seen: String(given.text) }));
      else if (event === 'catalogue') update((now) => ({ ...now, catalogue: given.types as Record<string, string[]> }));
      else if (event === 'error') update((now) => ({ ...now, error: String(given.message), done: true }));
      else if (event === 'stopped') update((now) => ({ ...now, error: 'Stopped', done: true }));
      else if (event === 'result') update((now) => ({ ...now, done: true }));
    }, method)
      .catch((error) => update((now) => ({ ...now, error: errorText(error), done: true })))
      .finally(() => { refresh(); setTimeout(() => setWork((now) => (now?.done && !now.error ? null : now)), 1500); });
  }, [refresh]);

  // work already running on the server (started here before, or by someone else): follow it from its start
  const running = estimate?.running.join(',') ?? '';
  useEffect(() => {
    if (!estimate || work) return;
    const kind = estimate.running[0] as Work['kind'] | undefined;
    if (kind) follow(kind, `/estimates/${estimate.id}/follow/${kind}`, undefined, 'GET');
  }, [running, estimate?.id]);

  const result = estimate?.result ?? null;
  const plan = useMemo(() => planOf(estimate?.programme ?? null), [estimate?.programme]);
  // what colours the model: each element's confidence (its type's), and the dates of the activity that builds it
  const live = work?.kind === 'run' && !work.done ? work : null;
  const looks = useMemo(() => {
    if (live) {
      // the run so far: each type the AI has decided fills in; the rest stays an outline
      const map = new Map<string, Look>();
      for (const [key, gids] of Object.entries(live.catalogue ?? {})) {
        const conf = live.decided[key];
        if (conf) for (const gid of gids) map.set(gid, { conf });
      }
      return map;
    }
    if (!result) return null;
    const map = new Map<string, Look>();
    for (const type of result.types) {
      const conf = type.mapping.decision === 'exclude' ? 'Excluded' : type.mapping.decision === 'unmapped' ? 'Not mapped' : type.mapping.confidence;
      for (const gid of type.gids) map.set(gid, { conf });
    }
    for (const activity of plan?.leaves ?? []) for (const ref of activity.refs) {
      const look = map.get(ref) ?? {};
      if (!look.start || activity.startDate < look.start) look.start = activity.startDate;
      if (!look.finish || activity.finishDate > look.finish) look.finish = activity.finishDate;
      map.set(ref, look);
    }
    return map;
  }, [result, plan, live?.decided, live?.catalogue]);

  const comments = useApi<{ id: string; on_kind: string; on_ref: string | null }[]>(`/projects/${id}/comments`).data ?? [];
  const view: View = chosenView ?? (result || live ? 'annotated' : 'original');
  // what is drawn on the model: the run's newest decisions numbered, or a dot per BOQ item; comment pins on elements
  const marks = useMemo(() => {
    const out: Mark[] = [];
    if (live) {
      if (labels) live.feed.filter((each): each is Card => 'key' in each && each.confidence !== 'Excluded').slice(0, 8)
        .forEach((card, at) => out.push({ key: `card:${card.key}`, gids: card.gids, kind: 'number', color: HEX[card.confidence], text: String(at + 1), label: card.title }));
    } else if (result && view === 'annotated') {
      const items = result.boq.length ? result.boq : result.takeoff_lines;
      for (const item of items) if (item.gids.length) {
        const ref = result.refs[item.code] ?? '';
        out.push({ key: item.code, gids: item.gids, kind: 'dot', color: HEX[item.confidence] ?? HEX.High, label: `${ref} ${item.description} · ${item.qty == null ? '' : num(item.qty)} ${item.unit}`.trim() });
      }
    }
    if (view !== 'skeleton') {
      const on = new Map<string, number>();
      for (const comment of comments) if (comment.on_kind === 'element' && comment.on_ref) on.set(comment.on_ref, (on.get(comment.on_ref) ?? 0) + 1);
      for (const [ref, count] of on) out.push({ key: `pin:${ref}`, gids: [ref], kind: 'pin', color: '#1f3a5f', text: String(count), label: `${count} comment${count > 1 ? 's' : ''}` });
    }
    return out;
  }, [live?.feed, labels, result, view, comments]);

  const isHidden = useMemo(() => {
    const models = new Set(hidden.models), classes = new Set(hidden.classes), storeys = new Set(hidden.storeys);
    return (element: Element) => models.has(element.model) || classes.has(`${element.model}:${element.cls}`) || storeys.has(`${element.model}:${element.storey}`);
  }, [hidden]);

  if (missing) return <p className="p-10 text-center">This project is not one of yours. <Link className="link font-semibold" to="/projects">Your projects</Link></p>;
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
    undo: estimate?.undo ? () => void send<Estimate>(`/estimates/${estimate.id}/history/undo`, 'POST').then((next) => put(`/projects/${id}/estimate`, next)) : null,
    redo: estimate?.redo ? () => void send<Estimate>(`/estimates/${estimate.id}/history/redo`, 'POST').then((next) => put(`/projects/${id}/estimate`, next)) : null,
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
          onSheet={setSheet}
        />
        <div className="flex min-h-0 flex-1">
          <nav className="flex w-[44px] shrink-0 flex-col items-center gap-[7px] border-r border-line pt-3">
            {rail.map(({ id: item, icon: Icon, label }) => (
              <button key={item} title={label} onClick={() => ws.open(shown === item ? null : item)} className={`grid h-[33px] w-[33px] place-items-center rounded-lg ${shown === item ? 'bg-primary-50 text-primary' : 'text-[#5b6570] hover:bg-paper'}`}>
                <Icon size={18} strokeWidth={1.6} />
              </button>
            ))}
          </nav>
          {shown && !programmeFull && (
            <aside className={`thin-scroll shrink-0 overflow-y-auto border-r border-line ${full ? 'flex-1' : ''}`} style={full ? undefined : { width: WIDTH[shown] }}>
              {shown === 'models' && <Models hidden={hidden} setHidden={setHidden} />}
              {shown === 'tree' && <Tree elements={elements} hidden={hidden} setHidden={setHidden} />}
              {shown === 'takeoff' && <Takeoff />}
              {shown === 'cost' && <Cost />}
              {shown === 'programme' && <ProgrammeList />}
              {shown === 'cashflow' && <CashFlow />}
            </aside>
          )}
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
                  if (key.startsWith('pin:')) { setSheet('conversation'); return; }
                  if (key.startsWith('card:')) { const card = live?.feed.find((each) => 'key' in each && `card:${each.key}` === key) as Card | undefined; if (card) viewer.current?.select(card.gids, false); return; }
                  const item = result && [...result.boq, ...result.takeoff_lines].find((each) => each.code === key);
                  setLine(line === key ? null : key);
                  if (item && line !== key) viewer.current?.select(item.gids, false);
                }}
                onPick={setPicked}
                onElements={setElements}
              />
              {fourD && <Readout />}
              {picked && !full && <Properties element={picked} onClose={() => { setPicked(null); viewer.current?.select(null); }} onComments={() => setSheet('conversation')} />}
            </div>
            {fourD && <Dock outline={outline} setOutline={setOutline} roofOff={roofOff} setRoofOff={setRoofOff} canvas={() => viewer.current?.canvas() ?? null} fit={() => viewer.current?.fit(true)} />}
          </div>
        </div>
        {estimate?.result && <Sidekick estimateId={estimate.id} projectId={project.id} projectName={project.name} links={links} />}
        {sheet === 'people' && <People project={project} onClose={() => setSheet(null)} />}
        {sheet === 'conversation' && <Conversation project={project} onClose={() => setSheet(null)} />}
        {sheet === 'versions' && <Versions onClose={() => setSheet(null)} />}
      </div>
    </WsContext.Provider>
  );
}

function TopBar(props: {
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


const Divider = () => <span className="mx-1 h-6 w-px bg-line" />;
const Tool = ({ title, on, onClick, children }: { title: string; on?: boolean; onClick: () => void; children: ReactNode }) => (
  <button title={title} className={`tool ${on ? 'on' : ''}`} onClick={onClick}>{children}</button>
);
const Segment = ({ title, on, disabled, onClick, children }: { title: string; on?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) => (
  <button title={title} aria-pressed={on} disabled={disabled} onClick={onClick} className={`grid h-[34px] w-9 place-items-center border-r border-line last:border-0 disabled:text-[#c3c7cb] ${on ? 'bg-primary-50 text-primary' : 'bg-white text-[#3b4652] hover:bg-paper'}`}>{children}</button>
);

/** Clicking an element shows its properties over the model: where it is in the BOQ (each item, its quantity from
 * this element and how it was measured), its IFC data and property sets, and a comment on it. */
function Properties({ element, onClose, onComments }: { element: Element; onClose: () => void; onComments: () => void }) {
  const ws = useWs();
  const gid = element.id.split('#')[1];
  const { data } = useApi<{ type: string | null; material: string[]; psets: Record<string, Record<string, unknown>> }>(`/models/${element.model}/elements/${encodeURIComponent(gid)}`);
  const [folded, setFolded] = useState(false);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const result = ws.result;
  // the takeoff rows measured from this element, under the BOQ item each went into
  const inBoq = useMemo(() => {
    if (!result) return [];
    const rows = result.takeoff.filter((row) => row.ref === element.id && row.qty);
    return rows.map((row) => {
      const item = result.boq.find((each) => row.code && each.lines.includes(row.code)) ?? result.takeoff_lines.find((each) => each.code === row.code);
      return { code: item?.code ?? row.code ?? '', ref: item ? result.refs[item.code] ?? '' : '', description: item?.description ?? row.description, confidence: item?.confidence, qty: row.qty, unit: row.unit, source: row.source };
    });
  }, [result, element.id]);
  const parent = data?.type ?? element.storey;
  const building = (ws.plan?.leaves ?? []).filter((activity) => activity.refs.includes(element.id));
  const post = () => {
    const body = new FormData();
    body.append('text', text.trim());
    body.append('on_kind', 'element');
    body.append('on_ref', element.id);
    body.append('on_label', `${element.cls.replace(/^Ifc/, '')} · ${element.name}`.slice(0, 200));
    send(`/projects/${ws.projectId}/comments`, 'POST', body, `/projects/${ws.projectId}/comments`, '/notifications')
      .then(() => { setText(''); setWriting(false); setError(''); }).catch((failure) => setError(errorText(failure)));
  };
  return (
    <aside className="thin-scroll absolute right-3 top-3 z-20 max-h-[75%] w-[320px] overflow-y-auto overscroll-contain rounded-xl border border-line bg-white shadow-pop">
      <header className="sticky top-0 flex items-center gap-2 bg-white px-3.5 py-2.5">
        <b className="flex-1 text-[13.5px]">Properties</b>
        <button title={folded ? 'Open' : 'Fold'} onClick={() => setFolded(!folded)}>{folded ? <ChevronDown size={15} className="text-[#7b848e]" /> : <ChevronUp size={15} className="text-[#7b848e]" />}</button>
        <button className="flex items-center gap-1 text-[12px] text-[#6b7581] hover:text-primary" onClick={() => setWriting(!writing)}><MessageSquare size={13} /> Comment</button>
        <button onClick={onClose} title="Close"><X size={16} className="text-[#7b848e]" /></button>
      </header>
      {!folded && (
        <div className="px-3.5 pb-3 text-[12.5px]">
          {writing && (
            <div className="mb-2.5 rounded-lg border border-line p-2">
              <textarea ref={(box) => box?.focus({ preventScroll: true })} rows={2} value={text} onChange={(event) => setText(event.target.value)} placeholder="A comment on this element…" className="w-full resize-none text-[12.5px] outline-none"
                onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && text.trim()) post(); }} />
              <div className="flex items-center gap-2">
                <button className="text-[11.5px] text-[#6b7581] hover:text-primary" onClick={onComments}>All comments</button>
                <span className="flex-1" />
                <button className="btn-primary h-[26px] px-3 text-[12px]" disabled={!text.trim()} onClick={post}>Post</button>
              </div>
              {error && <p className="mt-1 text-[11.5px] text-danger">{error}</p>}
            </div>
          )}
          {inBoq.length > 0 && (
            <section className="mb-2.5 rounded-lg bg-[#f1f5f9] px-2.5 py-2">
              <p className="text-[10.5px] font-semibold tracking-[0.1em] text-[#6b7581]">{result?.boq.length ? 'IN THE BOQ' : 'IN THE TAKEOFF'}</p>
              {inBoq.map((row, at) => (
                <button key={at} className="mt-1.5 block w-full text-left" onClick={() => { ws.open('takeoff'); ws.setBoqTab(result?.boq.length ? 'boq' : 'takeoff'); ws.setLine(row.code); }}>
                  <span className="leading-[1.45]"><b>{row.ref}</b> {row.description} {row.confidence && <Conf value={row.confidence} />}</span>
                  <small className="block text-[11.5px] text-[#6b7581]">{num(row.qty)} {row.unit}{row.source ? ` · ${row.source}` : ''}</small>
                </button>
              ))}
            </section>
          )}
          {building.length > 0 && (
            <section className="mb-2.5 rounded-lg bg-[#f1f5f9] px-2.5 py-2">
              <p className="text-[10.5px] font-semibold tracking-[0.1em] text-[#6b7581]">IN THE PROGRAMME</p>
              {building.map((activity) => (
                <button key={activity.id} className="mt-1.5 block w-full text-left" onClick={() => { ws.open('programme'); ws.setActivity(activity.id); ws.setDay(activity.start); }}>
                  <b className="font-semibold text-primary">{activity.id} {activity.name}</b>
                  <small className="block text-[11.5px] text-[#6b7581]">{dayName(parse(activity.startDate))} – {dayName(parse(activity.finishDate))}{activity.critical ? ' · critical' : ''}</small>
                </button>
              ))}
            </section>
          )}
          <dl>
            {([['Class', element.cls], ['Name', element.name], ['GlobalId', gid], ['Inside', parent], ['Model', ws.models.find((model) => model.id === element.model)?.name ?? ''], ['Material', data?.material.join(', ') ?? '']] as [string, string][])
              .filter(([, value]) => value).map(([name, value]) => (
                <div key={name} className="grid grid-cols-[88px_1fr] gap-2 py-1"><dt className="text-[#6b7581]">{name}</dt><dd className="break-words">{value}</dd></div>
              ))}
          </dl>
          {data && Object.keys(data.psets).length === 0 && <p className="mt-1.5 text-[#6b7581]">No property sets on this element.</p>}
          {data && Object.entries(data.psets).map(([name, values]) => (
            <details key={name} className="border-t border-line py-1.5">
              <summary className="cursor-pointer font-semibold">{name}</summary>
              <dl className="mt-1">{Object.entries(values).filter(([key]) => key !== 'id').map(([key, value]) => <div key={key} className="grid grid-cols-[110px_1fr] gap-2 py-0.5 text-[12px]"><dt className="truncate text-[#6b7581]" title={key}>{key}</dt><dd className="break-words">{String(value)}</dd></div>)}</dl>
            </details>
          ))}
        </div>
      )}
    </aside>
  );
}
