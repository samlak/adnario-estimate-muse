export const Icon = ({ title, disabled, onClick, children }: { title: string; disabled?: boolean; onClick?: (() => void) | null; children: React.ReactNode }) => (
  <button title={title} disabled={disabled} onClick={onClick ?? undefined} className="grid h-[29px] w-[29px] place-items-center rounded-lg border border-line text-[#3b4652] disabled:text-[#c3c7cb]">{children}</button>
);
