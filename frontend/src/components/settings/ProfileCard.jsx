import { useState } from 'react';
import { UserRound } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Switch from '../ui/Switch';
import { Field, Input } from '../ui/Field';
import { useAuth } from '../../context/AuthContext';
import { useAction } from '../../hooks/useAction';
import { authService } from '../../services/auth.service';

const NOTIFICATIONS = [
  { key: 'budgetAlerts', label: 'התראות תקציב', text: 'מייל כשמתקרבים לתקרת התקציב או חורגים ממנה' },
  { key: 'monthlySummary', label: 'סיכום חודשי', text: 'מייל ב-1 בכל חודש עם סיכום החודש שהסתיים' },
];

export default function ProfileCard() {
  const { user, setUser } = useAuth();
  const { run, pending } = useAction();
  const [name, setName] = useState(user.name);

  const save = async (data, message) => {
    const { ok, result } = await run(() => authService.updateProfile(data), message);
    if (ok) setUser(result.user);
  };

  return (
    <Card title="פרופיל והתראות" icon={UserRound}>
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          save({ name }, 'הפרופיל עודכן');
        }}
      >
        <Field label="שם מלא">
          <Input required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="אימייל">
          <Input dir="ltr" value={user.email} disabled />
        </Field>
        <Button type="submit" loading={pending} disabled={name.trim() === user.name}>
          שמירה
        </Button>
      </form>

      <ul className="mt-6 divide-y divide-line border-t border-line">
        {NOTIFICATIONS.map(({ key, label, text }) => (
          <li key={key} className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-sm text-ink-muted">{text}</p>
            </div>
            <Switch
              label={label}
              checked={Boolean(user.notifications?.[key])}
              disabled={pending}
              onChange={(value) => save({ notifications: { [key]: value } }, value ? `${label}: מופעל` : `${label}: כבוי`)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
