const TONE = {
  High: 'bg-success-50 text-success',
  Medium: 'bg-accent-50 text-[#a26a12]',
  Low: 'bg-warning-50 text-warning',
  Excluded: 'bg-[#eef0f2] text-[#6b7581]',
  'Not mapped': 'bg-danger-50 text-danger',
} as const;

export const Conf = ({ value }: { value: keyof typeof TONE }) => <span className={`pill ${TONE[value]}`}>{value}</span>;
