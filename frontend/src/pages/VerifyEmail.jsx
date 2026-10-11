import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import FormMessage from '../components/auth/FormMessage';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';

export default function VerifyEmail() {
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);

  if (!email) return <Navigate to="/login" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setPending(true);
    try {
      await verifyEmail({ email, code });
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  };

  const resend = async () => {
    setError('');
    setResending(true);
    try {
      await authService.resendCode(email);
      setNotice('שלחנו קוד חדש. בדקו גם בתיקיית הספאם');
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout title="אימות אימייל" subtitle={`שלחנו קוד בן 6 ספרות אל ${email}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="קוד אימות">
          <Input
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            className="text-center text-lg tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </Field>

        <FormMessage>{error}</FormMessage>
        <FormMessage type="success">{notice}</FormMessage>

        <Button type="submit" className="w-full" loading={pending} disabled={code.length !== 6}>
          אימות והתחברות
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <button type="button" onClick={resend} disabled={resending} className="font-semibold text-brand-600 hover:underline disabled:opacity-50">
          שליחת קוד חדש
        </button>
        <Link to="/login" className="text-ink-soft hover:underline">
          חזרה להתחברות
        </Link>
      </div>
    </AuthLayout>
  );
}
