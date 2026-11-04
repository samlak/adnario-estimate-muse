/** Sign in and Create an account (README §5): the navy side with the promise, the form on paper. */
import { Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorText } from '@/lib/api';
import { forget, send } from '@/lib/store';
import { DEMO_PASSWORD } from './constants';
import { AuthLayout } from './AuthLayout';
import { Field } from './Field';
import { Password } from './Password';
import { DemoAccounts } from './DemoAccounts';

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
    <AuthLayout top={<DemoAccounts onPick={(as) => enter(as, DEMO_PASSWORD)} />}>
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
    </AuthLayout>
  );
}
