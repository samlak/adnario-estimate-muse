import { Resizer } from '@/components/ui/Resizer';
import { DRAG, WIDTH } from './constants';
import { CashFlow } from './panels/cash-flow/CashFlow';
import { Cost } from './panels/cost/Cost';
import { Models } from './panels/models/Models';
import { Tree } from './panels/models/Tree';
import type { Hidden } from './panels/models/types';
import { ProgrammeList } from './panels/programme/ProgrammeList';
import { Takeoff } from './panels/takeoff/Takeoff';
import { useWs, type Panel } from './state';
import { useRemembered } from './useRemembered';
import type { Element } from './viewer/types';

/** The open panel beside the model, at its own width or full view; its edge drags wider or narrower, or shut. */
export function SidePanel({ shown, full, hidden, setHidden, elements }: {
  shown: Panel; full: boolean; hidden: Hidden; setHidden: (hidden: Hidden) => void; elements: Element[];
}) {
  const ws = useWs();
  const [widths, setWidths] = useRemembered<Partial<Record<Panel, number>>>('ws:widths', {});
  const width = Math.max(DRAG.min, Math.min(widths[shown] ?? WIDTH[shown], window.innerWidth * DRAG.max));
  const resize = (size: number) => {
    if (size < DRAG.close) { setWidths(widths); return ws.open(null); } // shut: it opens again at its width before the drag
    setWidths({ ...widths, [shown]: Math.max(DRAG.min, Math.min(size, window.innerWidth * DRAG.max)) });
  };
  return (
    <>
    <aside className={`thin-scroll shrink-0 overflow-y-auto border-r border-line ${full ? 'flex-1' : ''}`} style={full ? undefined : { width }}>
      {shown === 'models' && <Models hidden={hidden} setHidden={setHidden} />}
      {shown === 'tree' && <Tree elements={elements} hidden={hidden} setHidden={setHidden} />}
      {shown === 'takeoff' && <Takeoff />}
      {shown === 'cost' && <Cost />}
      {shown === 'programme' && <ProgrammeList />}
      {shown === 'cashflow' && <CashFlow />}
    </aside>
    {!full && <Resizer axis="x" onSize={resize} />}
    </>
  );
}
