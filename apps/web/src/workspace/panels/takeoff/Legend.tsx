const LEGEND = [['High', '#2e9d5b'], ['Medium', '#e0a93a'], ['Low', '#e0712f'], ['Excluded', '#b9bec4'], ['Not mapped', '#c0392b']];

export const Legend = () => (
  <p className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-[#59636e]">
    {LEGEND.map(([name, color]) => <span key={name} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{name}</span>)}
  </p>
);
