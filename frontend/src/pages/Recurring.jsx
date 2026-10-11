import { useState } from 'react';
import { Plus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import RecurringForm from '../components/recurring/RecurringForm';
import RecurringRow from '../components/recurring/RecurringRow';
import { useFetch } from '../hooks/useFetch';
import { useAction } from '../hooks/useAction';
import { recurringService } from '../services/recurring.service';
import { formatMoney } from '../utils/format';

// Converts every frequency to a monthly amount, for the summary cards
const MONTHLY_FACTOR = { daily: 30.44, weekly: 4.35, monthly: 1, yearly: 1 / 12 };

export default function Recurring() {
  const { data: payments, loading, error, reload } = useFetch(recurringService.list, []);
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const { run, pending } = useAction();

  if (loading && !payments) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const monthlyTotal = (type) =>
    payments.filter((p) => p.isActive && p.type === type).reduce((s, p) => s + p.amount * MONTHLY_FACTOR[p.frequency], 0);

  const act = async (action, message) => {
    const { ok } = await run(action, message);
    if (ok) reload();
    return ok;
  };

  return (
    <>
      <PageHeader title="הוראות קבע" subtitle="תשלומים והכנסות קבועים שנרשמים אוטומטית בתאריך שלהם">
        <Button icon={Plus} onClick={() => setEditing(null)}>
          הוראת קבע חדשה
        </Button>
      </PageHeader>

      {payments.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={RefreshCw}
            title="עדיין אין הוראות קבע"
            text="הוסיפו שכר דירה, מנויים או משכורת. המערכת תרשום את העסקה לבד בכל פעם שמגיע התאריך."
            action={
              <Button icon={Plus} onClick={() => setEditing(null)}>
                הוראת קבע חדשה
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="הוצאות קבועות בחודש" value={formatMoney(monthlyTotal('expense'), { round: true })} icon={TrendingDown} tone="danger" />
            <StatCard label="הכנסות קבועות בחודש" value={formatMoney(monthlyTotal('income'), { round: true })} icon={TrendingUp} tone="success" />
            <StatCard label="הוראות פעילות" value={payments.filter((p) => p.isActive).length} icon={RefreshCw} />
          </div>
          <ul className="card divide-y divide-line">
            {payments.map((payment) => (
              <RecurringRow
                key={payment.id}
                payment={payment}
                busy={pending}
                onToggle={(p) => act(() => recurringService.update(p.id, { isActive: !p.isActive }), p.isActive ? 'ההוראה הושהתה' : 'ההוראה הופעלה')}
                onRun={(p) => act(() => recurringService.runNow(p.id), `נרשמה עסקה: ${p.description}`)}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </ul>
        </>
      )}

      <RecurringForm open={editing !== undefined} payment={editing || null} onClose={() => setEditing(undefined)} onSaved={reload} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="מחיקת הוראת קבע"
        message={`למחוק את "${deleting?.description}"? עסקאות שכבר נרשמו יישארו.`}
        loading={pending}
        onConfirm={async () => (await act(() => recurringService.remove(deleting.id), 'הוראת הקבע נמחקה')) && setDeleting(null)}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
