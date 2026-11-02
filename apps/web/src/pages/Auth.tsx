/** Sign in and Create an account (README §5): the navy side with the promise, the form on paper. */
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, Lock, Mail, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Logo } from '@/components/ui';
import { errorText } from '@/lib/api';
import { forget, ROLE_NAME, send, useApi, type Role } from '@/lib/store';

const DEMO_PASSWORD = 'demo-password';
type DemoFirm = { firm: string; people: { name: string; email: string; role: Role }[] };

function Side() {
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

function Shell({ children, top }: { children: ReactNode; top?: ReactNode }) {
  return (
    <div className="compact flex overflow-hidden">
      <Side />
      <main className="thin-scroll relative h-full flex-1 overflow-y-auto bg-paper">
        {top}
        <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">{children}</div>
      </main>
    </div>
  );
}

function Field({ label, icon, hint, children }: { label: string; icon?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-medium">{label}</span>
      <span className="relative block">
        {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7b848e]">{icon}</span>}
        {children}
      </span>
      {hint && <span className="mt-1.5 block text-[12.5px] text-[#8a929b]">{hint}</span>}
    </label>
  );
}

function Password({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <input
        className="input h-[44px] pl-11 pr-11"
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      <button
        type="button"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7b848e]"
        onClick={() => setShown(!shown)}
        title={shown ? 'Hide password' : 'Show password'}
      >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </>
  );
}

function DemoAccounts({ onPick }: { onPick: (email: string) => void }) {
  const [open, setOpen] = useState(false);
  const firms = useApi<DemoFirm[]>('/auth/demo').data ?? [];
  if (!firms.length) return null;
  return (
    <div className="absolute right-[18px] top-[15px] z-10">
      <button
        className="flex h-10 items-center gap-2.5 rounded-xl bg-white px-3.5 text-[15px] font-semibold shadow-card hover:bg-paper"
        onClick={() => setOpen(!open)}
      >
        <Users size={17} /> Demo accounts {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="absolute right-0 mt-2.5 w-[372px] rounded-2xl border border-line bg-white p-3.5 shadow-pop">
          <p className="px-1 text-[12.5px] font-semibold tracking-[0.14em] text-[#6b7581]">SIGN IN AS</p>
          {firms.map((firm, index) => (
            <details key={firm.firm} open={index === 0} className="group mt-2.5">
              <summary className="cursor-pointer list-none px-1 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                <span className="mr-1.5 inline-block text-[11px] transition-transform group-open:rotate-90">▶</span>
                {firm.firm}
              </summary>
              <div className="mt-2.5 space-y-2.5">
                {firm.people
                  .map((person) => (
                    <button
                      key={person.email}
                      className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left hover:border-primary-200 hover:bg-primary-50"
                      onClick={() => onPick(person.email)}
                    >
                      <Avatar name={person.name} size={38} />
                      <span>
                        <b className="block text-[15px] font-semibold">{person.name}</b>
                        <span className="text-[13.5px] text-[#7b848e]">{ROLE_NAME[person.role]}</span>
                      </span>
                    </button>
                  ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

export function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const enter = async (as: string, secret: string) => {
    setBusy(true);
    setError('');
    try {
      await send('/auth/signin', 'POST', { email: as, password: secret });
      forget(); // whoever was signed in before: nothing of theirs is kept
      navigate('/');
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell top={<DemoAccounts onPick={(as) => enter(as, DEMO_PASSWORD)} />}>
      <form
        className="card w-full max-w-[520px] px-7 pb-7 pt-7"
        onSubmit={(event) => {
          event.preventDefault();
          void enter(email.trim(), password);
        }}
      >
        <h1 className="text-[26px] font-bold tracking-[-0.01em]">Sign in</h1>
        <p className="mt-1 text-[14px] text-[#6b7581]">Welcome back to Adnario Estimate.</p>
        <div className="mt-6 space-y-5">
          <Field label="Email address" icon={<Mail size={18} />}>
            <input className="input h-[44px] pl-11" type="email" placeholder="you@firm.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Password" icon={<Lock size={18} />}>
            <Password value={password} onChange={setPassword} />
          </Field>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button className="btn-primary mt-5 h-[44px] w-full rounded-lg text-[15px]" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="mt-6 text-center text-[13px] text-[#7b848e]">
        New firm? <Link to="/signup" className="font-semibold text-primary">Create an account</Link>. Joining a firm? Ask its admin to invite you.
      </p>
    </Shell>
  );
}

export function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', company: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (value: string) => setForm({ ...form, [key]: value }),
  });
  return (
    <Shell>
      <form
        className="card w-full max-w-[520px] px-7 pb-7 pt-7"
        onSubmit={async (event) => {
          event.preventDefault();
          if (form.password.length < 10) return setError('The password needs at least 10 characters.');
          if (form.password !== form.confirm) return setError('The two passwords differ.');
          // the person who signs up is the firm's Admin; the firm starts with Adnario Market Rates
          setBusy(true);
          try {
            await send('/auth/signup', 'POST', { name: form.name.trim(), company: form.company.trim(), email: form.email.trim(), password: form.password });
            forget();
            navigate('/');
          } catch (error) {
            setError(errorText(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="text-[26px] font-bold tracking-[-0.01em]">Create an account</h1>
        <p className="mt-1 text-[14px] text-[#6b7581]">You can invite your team once you are in.</p>
        <div className="mt-5 space-y-4">
          <Field label="Your name"><input className="input h-[44px]" {...bind(field('name'))} required /></Field>
          <Field label="Company name"><input className="input h-[44px]" {...bind(field('company'))} required /></Field>
          <Field label="Email address" icon={<Mail size={16} />}>
            <input className="input h-[44px] pl-11" type="email" placeholder="you@firm.com" {...bind(field('email'))} required />
          </Field>
          <Field label="Password" icon={<Lock size={16} />} hint="At least 10 characters."><Password {...field('password')} /></Field>
          <Field label="Confirm password" icon={<Lock size={16} />}><Password {...field('confirm')} /></Field>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button className="btn-primary mt-5 h-[44px] w-full rounded-lg text-[15px]" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <Link to="/signin" className="mt-6 text-[14px] font-semibold text-primary">Back to sign in</Link>
    </Shell>
  );
}

const bind = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => ({
  value,
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
});
