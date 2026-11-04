import { Menu } from 'lucide-react';
import { Bells } from './Bells';
import { AccountMenu } from './AccountMenu';

export function Header({ title, onMenu }: { title: string; onMenu: () => void }) {
  return (
    <header className="flex h-[66px] shrink-0 items-center gap-2 border-b border-line px-[18px] max-md:h-[56px] max-md:px-3">
      <button className="grid h-9 w-9 place-items-center rounded-lg text-[#3b4652] hover:bg-paper md:hidden" title="Menu" onClick={onMenu}><Menu size={20} /></button>
      <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-[-0.01em] md:text-[22px]">{title}</h1>
      <Bells />
      <AccountMenu />
    </header>
  );
}
