import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '@/components/ui/Sheet';
import { ago } from '@/lib/format';
import { send } from '@/lib/store';
import { useNotices, readNotice } from './notices';

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
