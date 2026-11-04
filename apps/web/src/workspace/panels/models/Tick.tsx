export const Tick = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
  <input type="checkbox" checked={on} onChange={onChange} className="h-[15px] w-[15px] accent-primary" />
);
