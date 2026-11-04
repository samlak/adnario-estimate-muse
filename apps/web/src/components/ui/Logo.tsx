export function Logo({ white = false, className = 'h-7' }: { white?: boolean; className?: string }) {
  return (
    <img
      src="/adnario-logo-dark.png"
      alt="Adnario"
      className={className}
      style={white ? { filter: 'brightness(0) invert(1)' } : undefined}
    />
  );
}
