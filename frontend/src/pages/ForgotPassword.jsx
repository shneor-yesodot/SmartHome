import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import FormMessage from '../components/auth/FormMessage';
import { authService } from '../services/auth.service';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title="שכחתם סיסמה?" subtitle="הזינו את האימייל שלכם, ונשלח קישור לבחירת סיסמה חדשה.">
      {sent ? (
        <FormMessage type="success">אם הכתובת רשומה במערכת, נשלח אליה קישור לאיפוס. הקישור תקף לשעה.</FormMessage>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="אימייל">
            <Input type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </Field>
          <FormMessage>{error}</FormMessage>
          <Button type="submit" className="w-full" loading={pending}>
            שליחת קישור לאיפוס
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          חזרה להתחברות
        </Link>
      </p>
    </AuthLayout>
  );
}
