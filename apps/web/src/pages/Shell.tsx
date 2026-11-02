/** The app outside a project (README §6): the sidebar's four pages, the header with the notification bell and the
 * account menu, and the sheets they open. */
import { Bell, Building2, ChevronDown, FileText, FolderKanban, LayoutGrid, LogOut, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Logo, Sheet } from '@/components/ui';
import { ago } from '@/lib/format';
import { can, forget, send, useApi, useMe } from '@/lib/store';

export type Notice = { id: string; project_id: string | null; title: string; text: string; read: boolean; created_at: string };
export const useNotices = () => useApi<Notice[]>('/notifications').data ?? [];
export const readNotice = (id: string) => send(`/notifications/${id}/read`, 'POST', undefined, '/notifications');

const TITLES: Record<string, string> = {
  '/': 'Dashboard', '/projects': 'Projects', '/rate-cards': 'Rate cards', '/organisation': 'Organisation', '/profile': 'My profile',
};

export function Shell() {
  const { me } = useMe();
  const { pathname } = useLocation();
  const pages = [
    { to: '/', label: 'Dashboard', icon: LayoutGrid },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    ...(can(me.role).seeRateCards ? [{ to: '/rate-cards', label: 'Rate cards', icon: FileText }] : []),
    ...(can(me.role).manageOrg ? [{ to: '/organisation', label: 'Organisation', icon: Building2 }] : []),
  ];
  return (
    <div className="compact flex">
      <nav className="flex w-[211px] shrink-0 flex-col border-r border-line bg-white px-[13px]">
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
        <Header title={TITLES[pathname] ?? ''} />
        <main className="thin-scroll flex-1 overflow-y-auto px-[34px] pb-10 pt-[21px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Header({ title }: { title: string }) {
  return (
    <header className="flex h-[66px] shrink-0 items-center border-b border-line px-[18px]">
      <h1 className="flex-1 text-[22px] font-bold tracking-[-0.01em]">{title}</h1>
      <Bells />
      <AccountMenu />
    </header>
  );
}

export function Bells({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const notices = useNotices();
  const unread = notices.filter((notice) => !notice.read).length;
  const navigate = useNavigate();
  return (
    <>
      <button className={`relative ${compact ? 'grid h-9 w-9 place-items-center' : 'mr-5 p-1.5'} text-[#59636e]`} title="Notifications" onClick={() => setOpen(true)}>
        <Bell size={compact ? 18 : 20} strokeWidth={1.7} />
        {unread > 0 && !compact && (
          <span className="absolute -right-0.5 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">{unread}</span>
        )}
      </button>
      {open && (
        <Sheet
          title="Notifications"
          onClose={() => setOpen(false)}
          actions={
            <button className="text-[13.5px] font-semibold text-primary" onClick={() => void send('/notifications/read', 'POST', undefined, '/notifications')}>
              Mark all read
            </button>
          }
        >
          <div className="space-y-2 bg-paper/60 p-3">
            {notices.length === 0 && <p className="p-6 text-center text-sm text-[#6b7581]">Nothing waiting for you.</p>}
            {notices.map((notice) => (
              <button
                key={notice.id}
                className={`flex w-full gap-3 rounded-xl border px-4 py-3.5 text-left ${notice.read ? 'border-line bg-white' : 'border-primary-100 bg-primary-50/60'}`}
                onClick={() => {
                  // reading a notification clears it
                  void readNotice(notice.id);
                  if (notice.project_id) navigate(`/projects/${notice.project_id}`);
                  setOpen(false);
                }}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notice.read ? 'bg-transparent' : 'bg-primary-500'}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex gap-2">
                    <b className="flex-1 text-[14px] font-semibold leading-snug">{notice.title}</b>
                    <small className="shrink-0 pt-0.5 text-[12px] text-[#8a929b]">{ago(notice.created_at)}</small>
                  </span>
                  <span className="mt-1 block truncate text-[13px] text-[#59636e]">“{notice.text}</span>
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => box.current?.contains(event.target as Node) || setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={box}>
      <button className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2" onClick={() => setOpen(!open)}>
        <Avatar name={me.name} size={compact ? 30 : 30} />
        {!compact && <span className="text-[14px] font-semibold">{me.name}</span>}
        <ChevronDown size={15} className="text-[#7b848e]" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[150px] rounded-xl border border-line bg-white py-1.5 shadow-pop">
          <MenuItem icon={<UserRound size={16} />} onClick={() => navigate('/profile')}>My profile</MenuItem>
          <MenuItem icon={<LogOut size={16} />} onClick={async () => { await send('/auth/signout', 'POST').catch(() => {}); forget(); navigate('/signin'); }}>Sign out</MenuItem>
        </div>
      )}
    </div>
  );
}

const MenuItem = ({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) => (
  <button className="flex w-full items-center gap-3 px-3.5 py-2 text-[14px] font-medium text-[#3b4652] hover:bg-paper" onClick={onClick}>
    <span className="text-[#6b7581]">{icon}</span> {children}
  </button>
);
