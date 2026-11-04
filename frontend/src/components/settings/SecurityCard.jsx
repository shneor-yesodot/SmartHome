import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { useAction } from '../../hooks/useAction';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';

/** Turning on an authenticator app: password -> scan -> confirm with a code -> save the backup codes. */
export default function SecurityCard() {
  const { user, setUser } = useAuth();
  const { run, pending } = useAction();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(null);
  const [backupCodes, setBackupCodes] = useState(null);
  const [disabling, setDisabling] = useState(false);

  const reset = () => {
    setPassword('');
    setCode('');
    setSetup(null);
    setDisabling(false);
  };

  const start = async (e) => {
    e.preventDefault();
    const { ok, result } = await run(() => authService.twoFactorSetup(password));
    if (ok) {
      setSetup(result);
      setPassword('');
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    const { ok, result } = await run(() => authService.twoFactorEnable(code.trim()), 'אימות דו-שלבי הופעל');
    if (ok) {
      setUser(result.user);
      setBackupCodes(result.backupCodes);
      reset();
    }
  };

  const disable = async (e) => {
    e.preventDefault();
    const { ok, result } = await run(() => authService.twoFactorDisable({ password, code: code.trim() }), 'אימות דו-שלבי כובה');
    if (ok) {
      setUser(result.user);
      reset();
    }
  };

  return (
    <Card
      title="אימות דו-שלבי"
      icon={ShieldCheck}
      action={user?.twoFactorEnabled ? <Badge tone="success">פעיל</Badge> : <Badge tone="warning">כבוי</Badge>}
    >
      {backupCodes && (
        <div className="mb-4 rounded-xl border border-warn-500/40 bg-surface p-4">
          <p className="text-sm font-semibold">שמרו את קודי הגיבוי במקום בטוח. הם לא יוצגו שוב.</p>
          <p className="mt-1 text-sm text-ink-soft">כל קוד עובד פעם אחת, אם הטלפון אבד או התקלקל.</p>
          <ul dir="ltr" className="tabular mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setBackupCodes(null)}>
            שמרתי אותם
          </Button>
        </div>
      )}

      {user?.twoFactorEnabled ? (
        disabling ? (
          <form onSubmit={disable} className="grid gap-4 sm:grid-cols-2">
            <Field label="סיסמה">
              <Input type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="קוד מהאפליקציה או קוד גיבוי">
              <Input dir="ltr" required autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="danger" loading={pending}>
                כיבוי
              </Button>
              <Button variant="secondary" onClick={reset}>
                ביטול
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">כל כניסה ממכשיר חדש דורשת גם קוד מהטלפון, כך שסיסמה שדלפה לא מספיקה כדי להיכנס.</p>
            <Button variant="secondary" onClick={() => setDisabling(true)}>
              כיבוי
            </Button>
          </div>
        )
      ) : setup ? (
        <form onSubmit={confirm} className="space-y-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <img src={setup.qr} alt="קוד QR להוספה לאפליקציית האימות" width={180} height={180} className="rounded-lg border border-line" />
            <div className="min-w-0 text-sm">
              <p>סרקו את הקוד באפליקציית אימות, למשל Google Authenticator או Authy.</p>
              <p className="mt-2 text-ink-soft">
                מהטלפון?{' '}
                <a href={setup.url} className="font-semibold text-brand-600 hover:underline">
                  פתיחה באפליקציה
                </a>{' '}
                או הקלדה ידנית:
              </p>
              <p dir="ltr" className="mt-1 select-all break-all rounded-lg bg-surface p-2 font-mono text-xs">
                {setup.secret}
              </p>
            </div>
          </div>
          <Field label="הקוד שמוצג באפליקציה">
            <Input dir="ltr" inputMode="numeric" autoFocus required autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[180px] text-center tracking-widest" />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" loading={pending}>
              הפעלה
            </Button>
            <Button variant="secondary" onClick={reset}>
              ביטול
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={start} className="space-y-4">
          <p className="text-sm text-ink-soft">מומלץ מאוד למערכת עם נתונים פיננסיים: גם אם הסיסמה תדלוף, אי אפשר יהיה להיכנס בלי הטלפון שלכם.</p>
          <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,280px)_auto] sm:justify-start">
            <Field label="סיסמה נוכחית">
              <Input type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" loading={pending} disabled={!password}>
              הגדרת אימות דו-שלבי
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
