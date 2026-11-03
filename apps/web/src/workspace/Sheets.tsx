/** The workspace's sheets: People on the project, the Conversation (comments, mentions, attachments), and the
 * models' Versions. README §7. */
import { AtSign, Bold, ChevronDown, FileText, Italic, List, ListOrdered, Paperclip, UserPlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, Sheet } from '@/components/ui';
import { errorText } from '@/lib/api';
import { stamp } from '@/lib/format';
import { ROLE_NAME, send, useApi, useMe, type Role } from '@/lib/store';
import { useWs, type Project } from './state';

type Member = { id: string; name: string; role: Role; access: 'edit' | 'view' };
type Comment = { id: string; on_kind: string; on_label: string; text: string; file: { name: string; size: number } | null; created_at: string; person_id: string; name: string };

const Select = ({ value, onChange, options, className = '' }: { value: string; onChange: (value: string) => void; options: [string, string][]; className?: string }) => (
  <span className={`relative inline-block ${className}`}>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-[37px] w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-8 text-[14px]">
      {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select>
    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7b848e]" />
  </span>
);

export function People({ project, onClose }: { project: Project; onClose: () => void }) {
  const { me } = useMe();
  const path = `/projects/${project.id}/members`;
  const people = (useApi<(Member & { invited: boolean })[]>('/team').data ?? []).filter((person) => !person.invited);
  const members = useApi<Member[]>(path).data ?? [];
  const others = people.filter((person) => !members.some((member) => member.id === person.id));
  const [who, setWho] = useState('');
  const [access, setAccess] = useState<'edit' | 'view'>('edit');
  const [error, setError] = useState('');
  const manage = me.role === 'admin' || me.role === 'qs';
  const act = (work: Promise<unknown>) => work.then(() => setError('')).catch((error) => setError(errorText(error)));
  return (
    <Sheet title="People" onClose={onClose} width={381}>
      <div className="px-5 py-4">
        {manage && (
          <>
            <Select className="w-full" value={who} onChange={setWho} options={others.length ? [['', 'Choose someone in the firm'], ...others.map((person) => [person.id, `${person.name} · ${ROLE_NAME[person.role]}`] as [string, string])] : [['', 'Everyone is already on it']]} />
            <div className="mt-2 flex gap-2">
              <Select className="flex-1" value={access} onChange={(value) => setAccess(value as 'edit' | 'view')} options={[['edit', 'Can edit'], ['view', 'Can view']]} />
              <button className="btn-primary h-[37px]" disabled={!who} onClick={() => { void act(send(path, 'POST', { person_id: who, access }, path)); setWho(''); }}><UserPlus size={15} /> Add</button>
            </div>
            {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
            <p className="mt-2.5 text-[12px] leading-[1.5] text-[#6b7581]">They are told, and the project appears on their dashboard. Can view: they look and comment, but change nothing, whatever their role allows elsewhere.</p>
          </>
        )}
        <ul className="mt-3">
          {members.map((member) => {
            const person = member;
            const choosable = person.role === 'qs' || person.role === 'contributor';
            return (
              <li key={member.id} className="flex items-center gap-2.5 border-b border-line py-3 last:border-0">
                <Avatar name={person.name} size={30} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[14px] font-semibold">{person.name}</b>
                  <span className="text-[12px] text-[#6b7581]">{ROLE_NAME[person.role]}{choosable ? '' : ` · ${member.access === 'edit' ? 'Can edit' : 'Can view'}`}</span>
                </span>
                {choosable && manage && (
                  <Select className="w-[100px]" value={member.access} onChange={(value) => void act(send(`${path}/${person.id}`, 'PATCH', { access: value }, path))} options={[['edit', 'Can edit'], ['view', 'Can view']]} />
                )}
                {manage && <button className="text-[12.5px] text-[#6b7581] hover:text-danger" onClick={() => void act(send(`${path}/${person.id}`, 'DELETE', undefined, path))}>Remove</button>}
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}

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

export function Versions({ onClose }: { onClose: () => void }) {
  const ws = useWs();
  const STATE = { current: 'in use', proposed: 'proposed, waiting for a QS', rejected: 'rejected', superseded: 'superseded' };
  return (
    <Sheet title="Versions" onClose={onClose}>
      <div className="space-y-2 px-5 py-4 text-[13px]">
        <p className="text-[#6b7581]">A new export of a model becomes its next version. The server works out, element by element, what was added, removed or changed; a QS or Admin accepts or rejects it in the Models panel.</p>
        {ws.models.map((model) => (
          <div key={model.id} className="rounded-xl border border-line px-3 py-2.5">
            <b className="block font-semibold">{model.name}</b>
            <span className="text-[12px] text-[#6b7581]">Version {model.version} · {STATE[model.state]} · {stamp(model.created_at)}{model.state === 'rejected' && model.note ? ` · ${model.note}` : ''}</span>
            {model.changes && <span className="block text-[12px] text-[#59636e]">{model.changes.added} added · {model.changes.removed} removed · {model.changes.changed} changed</span>}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
