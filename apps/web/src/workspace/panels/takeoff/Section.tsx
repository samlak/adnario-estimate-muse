export const Section = ({ name, span }: { name: string; span: number }) => (
  <tr className="border-b border-line bg-[#f7f9fb]"><td colSpan={span} className="px-1.5 py-2 text-[12.5px] font-bold">{name}</td></tr>
);
