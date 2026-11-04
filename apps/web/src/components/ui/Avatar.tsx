import { initials } from '@/lib/format';

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-primary-100 font-bold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(name)}
    </span>
  );
}
