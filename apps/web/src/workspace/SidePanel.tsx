import { WIDTH } from './constants';
import { CashFlow } from './panels/cash-flow/CashFlow';
import { Cost } from './panels/cost/Cost';
import { Models } from './panels/models/Models';
import { Tree } from './panels/models/Tree';
import type { Hidden } from './panels/models/types';
import { ProgrammeList } from './panels/programme/ProgrammeList';
import { Takeoff } from './panels/takeoff/Takeoff';
import type { Panel } from './state';
import type { Element } from './viewer/types';

/** The open panel beside the model, at its own width or full view. */
export function SidePanel({ shown, full, hidden, setHidden, elements }: {
  shown: Panel; full: boolean; hidden: Hidden; setHidden: (hidden: Hidden) => void; elements: Element[];
}) {
  return (
    <aside className={`thin-scroll shrink-0 overflow-y-auto border-r border-line ${full ? 'flex-1' : ''}`} style={full ? undefined : { width: WIDTH[shown] }}>
      {shown === 'models' && <Models hidden={hidden} setHidden={setHidden} />}
      {shown === 'tree' && <Tree elements={elements} hidden={hidden} setHidden={setHidden} />}
      {shown === 'takeoff' && <Takeoff />}
      {shown === 'cost' && <Cost />}
      {shown === 'programme' && <ProgrammeList />}
      {shown === 'cashflow' && <CashFlow />}
    </aside>
  );
}
