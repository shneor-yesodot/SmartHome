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
  google_closed: 'חשבון ה-Google הזה אינו מורשה להיכנס למערכת',
};

/** Only same-site paths are allowed (blocks open redirects). */
const safePath = (value) =>
  value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : null;

/** After a password (or Google, or a password reset), the authenticator app is still needed. */
const challengeFromUrl = () => new URLSearchParams(window.location.hash.slice(1)).get('challenge');

export default function Login() {
  const { login, loginTwoFactor, authConfig } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [challenge, setChallenge] = useState(() => location.state?.challenge || challengeFromUrl());
  const [code, setCode] = useState('');
  const [error, setError] = useState(GOOGLE_ERRORS[params.get('error')] || '');
  const [pending, setPending] = useState(false);
  const from = location.state?.from || safePath(params.get('returnTo')) || '/';

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const result = await login(form);
      if (result.twoFactorRequired) {
        setChallenge(result.challenge);
        setPending(false);
      } else if (result.verificationRequired) {
        navigate(`/verify-email?email=${encodeURIComponent(result.email)}`, { state: { from } });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await loginTwoFactor({ challenge, code: code.trim() });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setCode('');
      setPending(false);
    }
  };

  if (challenge) {
    return (
      <AuthLayout title="אימות דו-שלבי" subtitle="הזינו את הקוד מאפליקציית האימות בטלפון.">
        <form onSubmit={submitCode} className="space-y-4" noValidate>
          <Field label="קוד אימות" hint="אפשר גם להזין קוד גיבוי">
            <Input dir="ltr" autoFocus required autoComplete="one-time-code" inputMode="text" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} className="text-center tracking-widest" />
          </Field>
          <FormMessage>{error}</FormMessage>
          <Button type="submit" className="w-full" loading={pending} disabled={!code.trim()}>
            כניסה
          </Button>
        </form>
        <p className="mt-6 text-center text-sm">
          <button
            type="button"
            className="font-semibold text-brand-600 hover:underline"
            onClick={() => {
              setChallenge(null);
              setError('');
              window.history.replaceState(null, '', window.location.pathname);
            }}
          >
            חזרה להתחברות
          </button>
        </p>
      </AuthLayout>
    );
  }

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

      {authConfig.registration && (
        <p className="mt-6 text-center text-sm text-ink-soft">
          אין לכם חשבון?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">
            הרשמה
          </Link>
        </p>
      )}
    </AuthLayout>
  );
}
