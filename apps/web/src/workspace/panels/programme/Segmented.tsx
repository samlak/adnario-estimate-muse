/** A row of options, one chosen (Days / Weeks / Months, Gantt / Table / Cost curve). */
export function Segmented<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex rounded-lg bg-canvas p-0.5 text-[12px]">
      {options.map((each) => (
        <button key={each} onClick={() => onChange(each)} className={`rounded-md px-2.5 py-1 ${value === each ? 'bg-white font-semibold shadow-sm' : 'text-[#59636e]'}`}>{each}</button>
      ))}
    </div>
  );
}
