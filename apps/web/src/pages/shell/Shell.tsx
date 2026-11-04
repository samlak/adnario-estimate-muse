/** The app outside a project (README §6): the sidebar's four pages, the header with the notification bell and the
 * account menu, and the sheets they open. */
import { Building2, FileText, FolderKanban, LayoutGrid } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { can, useMe } from '@/lib/store';
import { Header } from './Header';

const TITLES: Record<string, string> = {
  '/': 'Dashboard', '/projects': 'Projects', '/rate-cards': 'Rate cards', '/organisation': 'Organisation', '/profile': 'My profile',
};

export function Shell() {
  const { me } = useMe();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false); // on a phone the sidebar is a drawer
  useEffect(() => setMenu(false), [pathname]);
  const pages = [
    { to: '/', label: 'Dashboard', icon: LayoutGrid },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    ...(can(me.role).seeRateCards ? [{ to: '/rate-cards', label: 'Rate cards', icon: FileText }] : []),
    ...(can(me.role).manageOrg ? [{ to: '/organisation', label: 'Organisation', icon: Building2 }] : []),
  ];
  return (
    <div className="compact flex">
      {menu && <div className="scrim md:hidden" onClick={() => setMenu(false)} />}
      <nav className={`w-[211px] shrink-0 flex-col border-r border-line bg-white px-[13px] max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[71] md:flex ${menu ? 'flex' : 'hidden'}`}>
        <div className="flex h-[66px] items-center"><Logo className="h-[27px]" /></div>
        <ul className="mt-1.5 space-y-1">
          {pages.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] ${isActive ? 'bg-primary-50 font-semibold text-ink' : 'text-[#4b5560] hover:bg-paper'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={19} strokeWidth={1.6} className={isActive ? 'text-primary' : 'text-[#7b848e]'} />
                    <span className="flex-1">{label}</span>
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={TITLES[pathname] ?? ''} onMenu={() => setMenu(true)} />
        <main className="thin-scroll flex-1 overflow-y-auto px-4 pb-10 pt-[21px] md:px-[34px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
