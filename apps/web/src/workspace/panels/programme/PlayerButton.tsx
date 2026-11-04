export const PlayerButton = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
  <button title={title} onClick={onClick} className="grid h-[25px] w-[25px] place-items-center rounded-md border border-line text-[#3b4652]">{children}</button>
);
