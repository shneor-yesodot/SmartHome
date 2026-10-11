import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import GoogleButton from '../components/auth/GoogleButton';
import FormMessage from '../components/auth/FormMessage';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register, authConfig } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('הסיסמאות אינן זהות');
    setError('');
    setPending(true);
    try {
      const result = await register({ name: form.name, email: form.email, password: form.password });
      if (result.verificationRequired) {
        navigate(`/verify-email?email=${encodeURIComponent(result.email)}`);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  };

  return (
    <AuthLayout title="יצירת חשבון" subtitle="כמה פרטים, ואפשר להתחיל לעקוב אחרי התקציב.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="שם מלא">
          <Input autoComplete="name" required value={form.name} onChange={set('name')} />
        </Field>
        <Field label="אימייל">
          <Input type="email" dir="ltr" autoComplete="email" required value={form.email} onChange={set('email')} placeholder="name@example.com" />
        </Field>
        <Field label="סיסמה" hint="לפחות 8 תווים, כולל אות באנגלית וספרה">
          <Input type="password" dir="ltr" autoComplete="new-password" required value={form.password} onChange={set('password')} />
        </Field>
        <Field label="אימות סיסמה">
          <Input type="password" dir="ltr" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
        </Field>

        <FormMessage>{error}</FormMessage>

        <Button type="submit" className="w-full" loading={pending}>
          יצירת חשבון
        </Button>
      </form>

      {authConfig.google && <GoogleButton />}

      <p className="mt-6 text-center text-sm text-ink-soft">
        כבר יש לכם חשבון?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          התחברות
        </Link>
      </p>
    </AuthLayout>
  );
}
