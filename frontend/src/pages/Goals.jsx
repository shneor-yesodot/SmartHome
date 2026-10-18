import { useState } from 'react';
import { AlertTriangle, PiggyBank, Plus, Wallet } from 'lucide-react';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import GoalCard from '../components/goals/GoalCard';
import GoalForm from '../components/goals/GoalForm';
import DepositForm from '../components/goals/DepositForm';
import { useFetch } from '../hooks/useFetch';
import { useAction } from '../hooks/useAction';
import { goalService } from '../services/goal.service';
import { formatMoney } from '../utils/format';

export default function Goals() {
  const { data: result, loading, error, reload } = useFetch(goalService.list, []);
  const [editing, setEditing] = useState(undefined);
  const [depositing, setDepositing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { run, pending } = useAction();

  if (loading && !result) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const goals = result.data;
  const month = result.meta.month;
  const saved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const behind = goals.filter((g) => ['behind', 'overdue'].includes(g.progress.status)).length;

  const confirmDelete = async () => {
    const { ok } = await run(() => goalService.remove(deleting.id), 'היעד נמחק');
    if (ok) {
      setDeleting(null);
      reload();
    }
  };

  return (
    <>
      <PageHeader title="יעדי חיסכון" subtitle="סכום, תאריך יעד, ומעקב אחרי הקצב">
        <Button icon={Plus} onClick={() => setEditing(null)}>
          יעד חדש
        </Button>
      </PageHeader>

      {goals.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={PiggyBank}
            title="עדיין לא הוגדרו יעדים"
            text="הגדירו למה אתם חוסכים, כמה צריך ועד מתי. נחשב כמה להפקיד בכל חודש ונראה אם אתם בקצב."
            action={
              <Button icon={Plus} onClick={() => setEditing(null)}>
                יעד חדש
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="נחסך בכל היעדים" value={formatMoney(saved, { round: true })} tone="success" icon={PiggyBank} />
            <StatCard
              label="פנוי לחיסכון החודש"
              value={formatMoney(month.free, { round: true })}
              tone={month.free < 0 ? 'danger' : 'neutral'}
              icon={Wallet}
              footnote={`הכנסות ${formatMoney(month.income, { round: true })} פחות הוצאות ${formatMoney(month.expense, { round: true })}${
                month.deposited ? ` ופחות ${formatMoney(month.deposited, { round: true })} שכבר הופקדו` : ''
              }`}
            />
            <StatCard
              label="היעדים צריכים עוד החודש"
              value={formatMoney(month.needed, { round: true })}
              tone={month.status === 'short' ? 'warning' : 'success'}
              footnote={behind ? `${behind} יעדים מפגרים מהקצב` : undefined}
            />
          </div>
          {month.status === 'short' && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl bg-warn-50 p-4 text-sm text-warn-600">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                אחרי ההוצאות של החודש נשארו {formatMoney(Math.max(month.free, 0), { round: true })}, והיעדים צריכים עוד{' '}
                {formatMoney(month.needed, { round: true })}. כדי לעמוד בקצב חסרים{' '}
                <b className="tabular">{formatMoney(month.shortfall, { round: true })}</b>: צמצום הוצאות או דחיית תאריך
                יעד.
              </p>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onDeposit={setDepositing} onEdit={setEditing} onDelete={setDeleting} />
            ))}
          </div>
        </>
      )}

      <GoalForm open={editing !== undefined} goal={editing || null} onClose={() => setEditing(undefined)} onSaved={reload} />
      <DepositForm goal={depositing} onClose={() => setDepositing(null)} onSaved={reload} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="מחיקת יעד"
        message={`למחוק את היעד "${deleting?.name}" ואת היסטוריית ההפקדות שלו?`}
        loading={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
