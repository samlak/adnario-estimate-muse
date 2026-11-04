import { CircleCheck, Loader2 } from 'lucide-react';
import { type Work } from '../../state';

/** The programme being read: the file, then its two steps. */
export function Reading({ work }: { work: Work }) {
  const step = (name: string) => work.stages.find((stage) => stage.name === name)?.state;
  return (
    <section className="rounded-xl border border-line px-3.5 py-3 text-[13px]">
      <b className="block truncate text-[13.5px]">{work.file ?? 'Your programme'}</b>
      <ul className="mt-2 space-y-1.5">
        {([['Read', 'Read your programme'], ['Link', 'Put the BOQ work under its activities']] as const).map(([name, label]) => {
          const state = step(name) ?? (name === 'Read' && !work.done ? 'start' : undefined);
          return (
            <li key={name} className={`flex items-center gap-2 ${state === 'done' ? 'text-[#59636e]' : state ? 'font-semibold' : 'text-[#9aa1a9]'}`}>
              {state === 'done' ? <CircleCheck size={14} className="text-success" /> : state && !work.done ? <Loader2 size={14} className="animate-spin text-primary" /> : <span className="h-3.5 w-3.5 rounded-full border border-[#c3c7cb]" />} {label}
            </li>
          );
        })}
      </ul>
      {work.error && <p className="mt-2 text-danger">{work.error}</p>}
    </section>
  );
}
