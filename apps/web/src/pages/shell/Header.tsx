import { Bells } from './Bells';
import { AccountMenu } from './AccountMenu';

export function Header({ title }: { title: string }) {
  return (
    <header className="flex h-[66px] shrink-0 items-center border-b border-line px-[18px]">
      <h1 className="flex-1 text-[22px] font-bold tracking-[-0.01em]">{title}</h1>
      <Bells />
      <AccountMenu />
    </header>
  );
}
