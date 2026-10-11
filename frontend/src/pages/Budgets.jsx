import { useState } from 'react';
import { Plus, Target } from 'lucide-react';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import BudgetCard from '../components/budgets/BudgetCard';
import BudgetForm from '../components/budgets/BudgetForm';
import { useFetch } from '../hooks/useFetch';
import { useAction } from '../hooks/useAction';
import { budgetService } from '../services/budget.service';
import { HEBREW_MONTHS, formatMoney } from '../utils/format';

export default function Budgets() {
  const { data: budgets, loading, error, reload } = useFetch(budgetService.list, []);
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const { run, pending } = useAction();

  if (loading && !budgets) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const exceeded = budgets.filter((b) => b.status === 'exceeded').length;

  const confirmDelete = async () => {
    const { ok } = await run(() => budgetService.remove(deleting.id), 'התקציב נמחק');
    if (ok) {
      setDeleting(null);
      reload();
    }
  };

  return (
    <>
      <PageHeader title="תקציבים" subtitle={`תקרת הוצאה חודשית לכל קטגוריה, ${HEBREW_MONTHS[new Date().getMonth()]}`}>
        <Button icon={Plus} onClick={() => setEditing(null)}>
          תקציב חדש
        </Button>
      </PageHeader>

      {budgets.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Target}
            title="עדיין לא הוגדרו תקציבים"
            text="בחרו קטגוריה, קבעו תקרה חודשית, ותקבלו התראה במייל כשמתקרבים אליה."
            action={
              <Button icon={Plus} onClick={() => setEditing(null)}>
                תקציב חדש
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="סך התקציב החודשי" value={formatMoney(totalBudget, { round: true })} />
            <StatCard label="נוצל עד היום" value={formatMoney(totalSpent, { round: true })} tone={totalSpent > totalBudget ? 'danger' : 'neutral'} />
            <StatCard label="תקציבים בחריגה" value={exceeded} tone={exceeded ? 'danger' : 'success'} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {budgets.map((b) => (
              <BudgetCard key={b.id} budget={b} onEdit={setEditing} onDelete={setDeleting} />
            ))}
          </div>
        </>
      )}

      <BudgetForm
        open={editing !== undefined}
        budget={editing || null}
        takenCategoryIds={budgets.map((b) => b.category.id)}
        onClose={() => setEditing(undefined)}
        onSaved={reload}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="מחיקת תקציב"
        message={`למחוק את התקציב של "${deleting?.category.name}"? העסקאות עצמן לא יימחקו.`}
        loading={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
