import { Check } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export function AuthSide() {
  return (
    <section
      className="relative hidden h-full w-[39.7%] shrink-0 overflow-hidden text-white lg:block"
      style={{
        background: 'linear-gradient(160deg, #1b3a63 0%, #1d4472 55%, #1a3d68 100%)',
      }}
    >
      {/* the drawing grid */}
      <div
        className="absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '46px 46px',
        }}
      />
      <div className="relative flex h-full flex-col px-[43px] pb-10 pt-10">
        <Logo white className="h-[33px] w-max" />
        <div className="mt-auto mb-auto pt-24">
          <h1 className="max-w-[400px] text-[33px] font-bold leading-[1.18] tracking-[-0.02em]">
            From building model to a measured bill of quantities.
          </h1>
          <ul className="mt-7 space-y-3 text-[16px] text-white/90">
            {['Measured from the model, never guessed', 'Every quantity traced to the elements it came from', 'The QS decides; the AI only interprets'].map((line) => (
              <li key={line} className="flex items-center gap-3">
                <Check size={16} className="text-accent" strokeWidth={2.5} /> {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-[13px] font-medium tracking-[0.16em] text-white/60">MADE FOR QUANTITY SURVEYORS · LAGOS</p>
      </div>
      {/* a skyline going up, and its crane */}
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 635 125" preserveAspectRatio="xMinYMax meet" aria-hidden>
        <g fill="#fff" fillOpacity="0.1">
          <rect x="22" y="72" width="66" height="53" /><rect x="98" y="42" width="52" height="83" />
          <rect x="158" y="96" width="80" height="29" /><rect x="252" y="56" width="58" height="69" />
          <rect x="320" y="94" width="72" height="31" /><rect x="499" y="62" width="62" height="63" />
          <rect x="569" y="88" width="56" height="37" />
        </g>
        <g stroke="#e8b13c" strokeWidth="2.4" fill="none">
          <path d="M427 125V22M376 22h155v30M397 22l30 15 30-15" />
        </g>
      </svg>
    </section>
  );
}
