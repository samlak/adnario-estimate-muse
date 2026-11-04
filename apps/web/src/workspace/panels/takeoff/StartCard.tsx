import { ChevronDown, ChevronUp, FileText, MessageSquareText, Paperclip, Play, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { errorText } from '@/lib/api';
import { send } from '@/lib/store';
import { useWs } from '../../state';
import { RUN_STEPS } from './runSteps';

/** Before a run: what it will do, project information for the AI (optional), then Start takeoff. */
export function StartCard() {
  const ws = useWs();
  const estimate = ws.estimate;
  const [text, setText] = useState(estimate?.info.text ?? '');
  const [sharing, setSharing] = useState(true);
  const [error, setError] = useState('');
  const busy = !!ws.work && !ws.work.done;
  const current = ws.models.filter((model) => model.state === 'current');
  const ready = current.some((model) => model.status === 'ready');
  if (!estimate) return null;
  const upload = (files: FileList | null) => {
    const body = new FormData();
    [...(files ?? [])].slice(0, 10).forEach((file) => body.append('files', file));
    send(`/estimates/${estimate.id}/documents`, 'POST', body, `/projects/${ws.projectId}/estimate`).catch((failure) => setError(errorText(failure)));
  };
  const given = !!text.trim() || !!estimate.info.documents?.length;
  return (
    <div className="p-[15px]">
      <section className="rounded-2xl border border-line px-[18px] py-[16px]">
        <p className="text-[11.5px] font-bold tracking-[0.12em] text-primary">READY FOR TAKEOFF</p>
        <h2 className="mt-1 text-[16.5px] font-bold">{current.length > 1 ? `${current.length} models` : current[0]?.name ?? 'No model yet'}</h2>
        {current.length > 1 && <p className="mt-1 text-[12.5px] text-[#59636e]">{current.map((model) => model.name).join(' · ')}. One BOQ for all of them; elements modelled in two disciplines are billed once.</p>}
        <ol className="mt-3 space-y-2.5 text-[13px]">
          {RUN_STEPS.filter(([name]) => name !== 'Context').map(([name, label], at) => (
            <li key={name} className="flex items-center gap-3"><span className="grid h-[19px] w-[19px] place-items-center rounded-full bg-[#eef1f4] text-[10.5px] font-semibold text-[#3b4652]">{at + 1}</span>{label}</li>
          ))}
        </ol>
        <div className="mt-4 border-t border-line pt-3">
          <button className="flex w-full items-center gap-2 text-left text-[13px] font-semibold text-primary" onClick={() => setSharing(!sharing)}>
            <MessageSquareText size={15} /> Share something about this project? <small className="font-normal text-[#9aa1a9]">optional</small>
            {given && <i className="h-1.5 w-1.5 rounded-full bg-success" />}
            <span className="flex-1" />{sharing ? <ChevronUp size={15} className="text-[#6b7581]" /> : <ChevronDown size={15} className="text-[#6b7581]" />}
          </button>
          {sharing && (
            <div className="mt-2.5 rounded-xl border border-line px-3 pb-2 pt-2 focus-within:border-primary-300">
              <textarea className="h-[78px] w-full resize-y bg-transparent text-[13px] leading-[1.5] outline-none placeholder:text-[#9aa1a9]" placeholder="Location, use, specification… e.g. 2-storey office in Lekki, Lagos. C25 concrete, 225mm sandcrete walls."
                value={text} disabled={!ws.editor} onChange={(event) => setText(event.target.value)} onBlur={() => text !== (estimate.info.text ?? '') && void send(`/estimates/${estimate.id}/info`, 'PATCH', { text })} />
              <div className="flex items-center gap-2.5">
                <label className={`flex h-[30px] items-center gap-1.5 rounded-full border border-line px-3 text-[12.5px] ${ws.editor ? 'cursor-pointer hover:border-primary-300' : 'opacity-60'}`}>
                  <Paperclip size={13} /> Attach
                  <input type="file" multiple hidden accept=".pdf,.docx,.txt,.md" disabled={!ws.editor} onChange={(event) => upload(event.target.files)} />
                </label>
                <small className="text-[12px] text-[#9aa1a9]">PDF, Word or text</small>
              </div>
            </div>
          )}
          {(estimate.info.documents ?? []).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">{(estimate.info.documents ?? []).map((name) => <li key={name} className="flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[12px] text-primary"><FileText size={12} /> {name}</li>)}</ul>
          )}
        </div>
        {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
        <button className="btn-primary mt-4 h-[42px] w-full rounded-lg text-[14px]" disabled={!ws.editor || busy || !ready} onClick={async () => {
          if (text !== (estimate.info.text ?? '')) await send(`/estimates/${estimate.id}/info`, 'PATCH', { text });
          ws.start('run');
        }}><Play size={15} /> {busy ? 'Running…' : 'Start takeoff'}</button>
        {!ready && <p className="mt-2 text-[12px] text-[#6b7581]">{ws.models.length ? 'Waiting for the models to convert…' : 'Upload the building models first: Import IFC, top left.'}</p>}
        {!ws.editor && <p className="mt-2 text-[12px] text-[#6b7581]">Only a QS or Admin who can edit this project starts the takeoff.</p>}
        <p className="mt-3 flex gap-2 text-[12px] leading-[1.5] text-[#59636e]"><ShieldCheck size={14} className="mt-0.5 shrink-0" /><span>Only a summary of element <i>types</i> goes to the AI, never the model file. Rates are left blank for you to price.</span></p>
      </section>
    </div>
  );
}
