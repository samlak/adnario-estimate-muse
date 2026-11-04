import { CalendarDays, Upload } from 'lucide-react';
import { useWs } from '../../state';
import { upload } from './upload';
import { Reading } from './Reading';
import { useDrop } from './useDrop';

export function UploadCard() {
  const ws = useWs();
  const { over, refused, can, ready, handlers } = useDrop();
  return (
    <div className="h-full px-[15px] pt-[15px] text-[13px]" {...handlers}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-primary"><CalendarDays size={13} /> PROGRAMME</p>
      <h2 className="mt-1.5 text-[15.5px] font-bold">No programme yet</h2>
      <p className="mt-1 leading-[1.55] text-[#59636e]">Upload the contractor's programme of works as a PDF. Its activities, durations and links are kept as written; the AI puts the BOQ's measured work under each activity (code checks it), so each shows its BOQ lines, cost and elements in the 4D.</p>
      <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed px-3 py-3 ${over ? 'border-primary bg-primary-50' : 'border-[#c9ced4]'}`}>
        <label className={`btn-primary h-[34px] whitespace-nowrap rounded-lg px-3 ${can ? 'cursor-pointer' : 'pointer-events-none opacity-60'}`}>
          <Upload size={15} /> Upload your programme (PDF)
          <input type="file" accept="application/pdf" hidden onChange={(event) => upload(ws.start, event.target.files)} />
        </label>
        <span className="text-[#59636e]">or drop the PDF here</span>
      </div>
      {refused ? <p className="mt-2 text-[12.5px] text-danger">{refused}</p> : !ready && <p className="mt-2 text-[12px] text-[#6b7581]">It waits for a generated BOQ: generate it in Takeoff first.</p>}
      {ws.work?.kind === 'programme' && <div className="mt-3"><Reading work={ws.work} /></div>}
    </div>
  );
}
