import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { useAction } from '../../hooks/useAction';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' };

export default function PasswordCard() {
  const toast = useToast();
  const { startSession } = useAuth();
  const { run, pending } = useAction();
  const [form, setForm] = useState(EMPTY);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return toast.error('הסיסמאות החדשות אינן זהות');
    const { ok, result } = await run(
      () => authService.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      'הסיסמה עודכנה, ושאר המכשירים נותקו'
    );
    if (ok) {
      // The server revoked every session and issued a new one for this device
      startSession(result);
      setForm(EMPTY);
    }
  };

  return (
    <Card title="החלפת סיסמה" icon={KeyRound}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
        <Field label="סיסמה נוכחית">
          <Input type="password" dir="ltr" autoComplete="current-password" required value={form.currentPassword} onChange={set('currentPassword')} />
        </Field>
        <Field label="סיסמה חדשה" hint="לפחות 8 תווים, כולל אות באנגלית וספרה">
          <Input type="password" dir="ltr" autoComplete="new-password" required minLength={8} value={form.newPassword} onChange={set('newPassword')} />
        </Field>
        <Field label="אימות הסיסמה החדשה">
          <Input type="password" dir="ltr" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" loading={pending}>
            עדכון סיסמה
          </Button>
        </div>
      </form>
    </Card>
  );
}
