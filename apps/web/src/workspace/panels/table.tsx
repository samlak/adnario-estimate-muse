/** The panels' tables: a header row, a section row, and lines grouped by section in Nigerian element order. */


export const Head = ({ cols }: { cols: [string, string?][] }) => (
  <thead className="bg-[#f4f3ef]"><tr>{cols.map(([name, align = 'left']) => <th key={name} className="th py-2 text-[10.5px]" style={{ textAlign: align as 'left' }}>{name}</th>)}</tr></thead>
);
export const Section = ({ name, span }: { name: string; span: number }) => (
  <tr className="border-b border-line bg-[#f7f9fb]"><td colSpan={span} className="px-1.5 py-2 text-[12.5px] font-bold">{name}</td></tr>
);

/** Lines grouped under their sections, in the order they come (Nigerian elemental order). */
export function bySection<T extends { section: string }>(lines: T[]): [string, T[]][] {
  const out: [string, T[]][] = [];
  for (const line of lines) {
    const last = out[out.length - 1];
    if (last?.[0] === line.section) last[1].push(line);
    else out.push([line.section, [line]]);
  }
  return out;
}
