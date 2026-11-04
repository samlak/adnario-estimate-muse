/** Asks first: every delete does (README §6). */
export function Confirm({ title, message, label = 'Delete', onConfirm, onCancel }: {
  title: string;
  message: string;
  label?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/30 p-4" onClick={onCancel}>
      <div className="card w-full max-w-sm p-6" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-1.5 text-sm text-[#6b7581]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn bg-danger text-white hover:bg-danger-600" onClick={onConfirm}>{label}</button>
        </div>
      </div>
    </div>
  );
}
