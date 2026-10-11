import { Loader2, WifiOff } from 'lucide-react';
import Button from './Button';

export function PageLoader({ label = 'טוען נתונים' }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-ink-muted" role="status">
      <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50 text-danger-500">
        <WifiOff className="h-6 w-6" />
      </span>
      <p className="font-semibold">לא הצלחנו לטעון את הנתונים</p>
      <p className="text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          ניסיון נוסף
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action, compact = false }) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'gap-2 py-6' : 'gap-3 py-12'}`}>
      {Icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
          <Icon className="h-7 w-7" />
        </span>
      )}
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-sm text-sm leading-relaxed text-ink-muted">{text}</p>}
      {action}
    </div>
  );
}
