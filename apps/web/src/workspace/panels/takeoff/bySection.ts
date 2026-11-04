/** The panels' tables: a header row, a section row, and lines grouped by section in Nigerian element order. */

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
