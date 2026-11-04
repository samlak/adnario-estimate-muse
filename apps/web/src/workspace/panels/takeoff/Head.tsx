export const Head = ({ cols }: { cols: [string, string?][] }) => (
  <thead className="bg-[#f4f3ef]"><tr>{cols.map(([name, align = 'left']) => <th key={name} className="th py-2 text-[10.5px]" style={{ textAlign: align as 'left' }}>{name}</th>)}</tr></thead>
);
