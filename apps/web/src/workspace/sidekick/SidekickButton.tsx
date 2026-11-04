import { Sparkles } from 'lucide-react';

/** The closed sidekick: a button at the workspace's bottom right. */
export function SidekickButton({ projectName, onOpen }: { projectName: string; onOpen: () => void }) {
  return (
    <button className="sidekickBtn" id="sidekickBtn" title={`Ask Adnario AI about ${projectName}`} onClick={onOpen}>
      <Sparkles /> Adnario AI
    </button>
  );
}
