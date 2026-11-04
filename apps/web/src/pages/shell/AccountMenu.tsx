import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { forget, send, useMe } from '@/lib/store';

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
