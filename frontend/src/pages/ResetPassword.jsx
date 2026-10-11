import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import FormMessage from '../components/auth/FormMessage';
import { useAuth } from '../context/AuthContext';

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState(token ? '' : 'הקישור אינו שלם. בקשו קישור חדש');
  const [pending, setPending] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('הסיסמאות אינן זהות');
    setError('');
    setPending(true);
    try {
      await resetPassword({ token, password: form.password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  };

  return (
    <AuthLayout title="בחירת סיסמה חדשה" subtitle="אחרי השמירה תחוברו אוטומטית, ושאר המכשירים ינותקו.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="סיסמה חדשה" hint="לפחות 8 תווים, כולל אות באנגלית וספרה">
          <Input type="password" dir="ltr" autoComplete="new-password" required value={form.password} onChange={set('password')} />
        </Field>
        <Field label="אימות סיסמה">
          <Input type="password" dir="ltr" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
        </Field>
        <FormMessage>{error}</FormMessage>
        <Button type="submit" className="w-full" loading={pending} disabled={!token}>
          שמירת הסיסמה
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link to="/forgot-password" className="font-semibold text-brand-600 hover:underline">
          בקשת קישור חדש
        </Link>
      </p>
    </AuthLayout>
  );
}
