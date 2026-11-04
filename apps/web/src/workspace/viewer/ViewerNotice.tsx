/** A note over the model: an error, models converting or loading, or no models yet. */
export function ViewerNotice({ text, empty }: { text: string | null; empty: boolean }) {
  return (
    <>
      {text && (
        <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-white px-3 py-1.5 text-[12.5px] text-[#59636e] shadow-card">{text}</p>
      )}
      {empty && <p className="absolute inset-0 grid place-items-center text-[14px] text-[#6b7581]">No models yet: use Import IFC to add the building's models.</p>}
    </>
  );
}
