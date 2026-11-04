import { Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorText } from '@/lib/api';
import { forget, send } from '@/lib/store';
import { AuthLayout } from './AuthLayout';
import { Field } from './Field';
import { Password } from './Password';

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
    <AuthLayout>
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
    </AuthLayout>
  );
}
