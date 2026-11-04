/** The project workspace (README §7): the bar, the rail, the side panel, the 3D model, the properties of the clicked
 * element, the programme's dock, and Adnario AI at the bottom right. */
import { Banknote, Boxes, CalendarDays, LineChart, ListTree, Ruler } from 'lucide-react';
import { num } from '@/lib/format';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorText } from '@/lib/api';
import { can, put, reload, send, useApi, useMe } from '@/lib/store';
import { CashFlow } from './panels/CashFlow';
import { Cost } from './panels/Cost';
import { Models, Tree, type Hidden } from './panels/Models';
import { Dock, Readout } from './panels/Dock';
import { ProgrammeList } from './panels/Programme';
import { Takeoff } from './panels/Takeoff';
import { Conversation, People, Versions } from './Sheets';
import { Sidekick } from './sidekick/Sidekick';
import './sidekick/sidekick.css';
import { DATA_PANELS, dayOfWeek, planOf, WsContext, type Card, type Estimate, type Model, type Panel, type Project, type Work, type Ws } from './state';
import { streamRun } from './sidekick/stream';
import { HEX, Viewer, type Element, type Look, type Mark, type View, type ViewerHandle } from './Viewer';
import { TopBar } from './TopBar';
import { Properties } from './Properties';

const WIDTH: Record<Panel, number> = { models: 285, tree: 313, takeoff: 475, cost: 360, programme: 405, cashflow: 447 };
const RAIL: { id: Panel; icon: typeof Boxes; label: string; money?: boolean }[] = [
  { id: 'models', icon: Boxes, label: 'Models' },
  { id: 'tree', icon: ListTree, label: 'Tree' },
  { id: 'takeoff', icon: Ruler, label: 'Takeoff', money: true },
  { id: 'cost', icon: Banknote, label: 'Cost', money: true },
  { id: 'programme', icon: CalendarDays, label: 'Programme' },
  { id: 'cashflow', icon: LineChart, label: 'Cash flow', money: true },
];

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

