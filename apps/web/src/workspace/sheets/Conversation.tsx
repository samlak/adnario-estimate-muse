import { AtSign, Bold, FileText, Italic, List, ListOrdered, Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Sheet } from '@/components/ui/Sheet';
import { errorText } from '@/lib/api';
import { stamp } from '@/lib/format';
import { ROLE_NAME, send, useApi, useMe } from '@/lib/store';
import { type Project } from '../state';
import { Member, Comment } from './types';

export function Conversation({ project, onClose }: { project: Project; onClose: () => void }) {
  const { me } = useMe();
  const path = `/projects/${project.id}/comments`;
  // a Contributor cannot see the BOQ, so the server leaves out the comments on its lines too
  const comments = useApi<Comment[]>(path).data ?? [];
  const members = useApi<Member[]>(`/projects/${project.id}/members`).data ?? [];
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mentioning, setMentioning] = useState(false);
  const [query, setQuery] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLLIElement>(null);
  // opens on the newest (braces: Chrome's scrollIntoView returns a Promise, which React would take for a cleanup)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [comments.length]);
  const wrap = (before: string, after = before) => {
    const area = box.current!;
    const { selectionStart: from, selectionEnd: to } = area;
    setText(text.slice(0, from) + before + text.slice(from, to) + after + text.slice(to));
    setTimeout(() => area.focus());
  };
  const post = () => {
    if (!text.trim()) return;
    // mentioning someone notifies them; someone in the firm who is not on the project is added to it (the server)
    const body = new FormData();
    body.append('text', text.trim());
    if (file) body.append('file', file);
    send(path, 'POST', body, path, '/notifications').then(() => { setText(''); setFile(null); setError(''); }).catch((error) => setError(errorText(error)));
  };
  return (
    <Sheet title="Conversation" onClose={onClose} width={381}
      footer={
        <div className="w-full">
          <div className="relative rounded-xl border border-line px-3 pb-2 pt-2.5 focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100">
            <textarea ref={box} rows={2} placeholder="Write a message..." value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) post(); }} className="w-full resize-none bg-transparent text-[13.5px] outline-none placeholder:text-[#9aa1a9]" />
            <div className="mt-1 flex items-center gap-3 text-[#6b7581]">
              <button title="Bold" onClick={() => wrap('**')}><Bold size={15} /></button>
              <button title="Italic" onClick={() => wrap('_')}><Italic size={15} /></button>
              <button title="List" onClick={() => wrap('\n- ', '')}><List size={15} /></button>
              <button title="Numbered list" onClick={() => wrap('\n1. ', '')}><ListOrdered size={15} /></button>
              <span className="h-4 w-px bg-line" />
              <button title="Mention someone" onClick={() => setMentioning(!mentioning)}><AtSign size={15} /></button>
              <button title="Attach files" onClick={() => picker.current?.click()}><Paperclip size={15} /></button>
              <input ref={picker} type="file" hidden onChange={(event) => { const chosen = event.target.files?.[0]; if (chosen && chosen.size <= 50 * 1024 * 1024) setFile(chosen); }} />
              <span className="flex-1" />
              <button className="btn-primary h-[30px] px-4" disabled={!text.trim()} onClick={post}>Send</button>
            </div>
            {mentioning && (
              <div className="absolute bottom-[46px] right-2 z-10 w-[240px] rounded-xl border border-line bg-white p-1.5 shadow-pop">
                <input autoFocus placeholder="Mention..." value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 w-full px-2 text-[13px] outline-none" />
                <p className="px-2 pb-1 pt-1.5 text-[10.5px] font-semibold tracking-[0.12em] text-[#6b7581]">ON THIS PROJECT</p>
                {members.filter((person) => person.name.toLowerCase().includes(query.toLowerCase())).map((person) => (
                  <button key={person.id} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-canvas" onClick={() => { setText(`${text}${text && !text.endsWith(' ') ? ' ' : ''}@${person.name} `); setMentioning(false); setQuery(''); box.current?.focus(); }}>
                    <Avatar name={person.name} size={26} />
                    <span><b className="block text-[13px] font-semibold">{person.name}</b><span className="text-[11.5px] text-[#6b7581]">{ROLE_NAME[person.role]}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {error && <p className="mt-1.5 text-[12.5px] text-danger">{error}</p>}
          {file && (
            <div className="mt-2 flex w-max items-center gap-2.5 rounded-xl border border-line px-2.5 py-1.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-canvas"><FileText size={15} className="text-[#59636e]" /></span>
              <span><b className="block text-[12.5px] font-semibold">{file.name}</b><small className="text-[11px] text-[#6b7581]">{Math.max(1, Math.round(file.size / 1024))} KB</small></span>
              <button title="Remove" onClick={() => setFile(null)}><X size={14} className="text-[#9aa1a9]" /></button>
            </div>
          )}
        </div>
      }
    >
      <ul className="space-y-4 px-5 py-4">
        {comments.length === 0 && <p className="py-6 text-center text-[13px] text-[#6b7581]">No comments yet. Start the conversation.</p>}
        {comments.map((comment) => {
          const tagged = comment.on_label !== 'An estimate';
          return (
            <li key={comment.id} className="group flex gap-2.5">
              <Avatar name={comment.name} size={26} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <b className="text-[13.5px] font-semibold">{comment.name}</b>
                  <small className="flex-1 text-[11.5px] text-[#9aa1a9]">{stamp(comment.created_at)}</small>
                  {comment.person_id === me.id && <button className="text-[11.5px] font-semibold text-[#9aa1a9] opacity-0 group-hover:opacity-100" onClick={() => void send(`/comments/${comment.id}`, 'DELETE', undefined, path)}>Remove</button>}
                </p>
                {tagged ? <p className="mt-1 truncate rounded-md bg-accent-50 px-1.5 py-0.5 text-[11.5px] font-semibold text-accent-600">{comment.on_label}</p> : <p className="text-[11px] font-semibold text-[#9aa1a9]">An estimate</p>}
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.55]">{comment.text}</p>
                {comment.file && <a href={`/api/v1/comments/${comment.id}/file`} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[12px] hover:border-primary-300"><FileText size={13} /> {comment.file.name} · {Math.max(1, Math.round(comment.file.size / 1024))} KB</a>}
              </div>
            </li>
          );
        })}
        <li ref={end} />
      </ul>
    </Sheet>
  );
}
