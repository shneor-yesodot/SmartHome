import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import GoogleButton from '../components/auth/GoogleButton';
import FormMessage from '../components/auth/FormMessage';
import { useAuth } from '../context/AuthContext';

// Errors the server reports back after the Google round trip
const GOOGLE_ERRORS = {
  google: 'ההתחברות עם Google נכשלה. נסו שוב',
  google_unavailable: 'התחברות עם Google אינה מוגדרת בשרת',
};

export default function Login() {
  const { login, authConfig } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(GOOGLE_ERRORS[params.get('error')] || '');
  const [pending, setPending] = useState(false);
  const from = location.state?.from || '/';

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const result = await login(form);
      if (result.verificationRequired) {
        navigate(`/verify-email?email=${encodeURIComponent(result.email)}`, { state: { from } });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  };

  return (
    <AuthLayout title="התחברות" subtitle="ברוכים השבים. הזינו את פרטי החשבון שלכם.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="אימייל">
          <Input type="email" dir="ltr" autoComplete="email" required value={form.email} onChange={set('email')} placeholder="name@example.com" />
        </Field>
        <Field label="סיסמה">
          <Input type="password" dir="ltr" autoComplete="current-password" required value={form.password} onChange={set('password')} />
        </Field>
        <div className="-mt-1 text-start">
          <Link to="/forgot-password" className="text-[13px] font-medium text-brand-600 hover:underline">
            שכחתם סיסמה?
          </Link>
        </div>

        <FormMessage>{error}</FormMessage>

        <Button type="submit" className="w-full" loading={pending}>
          התחברות
        </Button>
      </form>

      {authConfig.google && <GoogleButton returnTo={from} />}

      <p className="mt-6 text-center text-sm text-ink-soft">
        אין לכם חשבון?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:underline">
          הרשמה
        </Link>
      </p>
    </AuthLayout>
  );
}
