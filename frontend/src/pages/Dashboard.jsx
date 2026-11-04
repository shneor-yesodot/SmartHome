import { useState } from 'react';
import { Plus } from 'lucide-react';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import { ErrorState, PageLoader } from '../components/ui/States';
import SummaryCards from '../components/dashboard/SummaryCards';
import HealthScore from '../components/dashboard/HealthScore';
import AiInsights from '../components/dashboard/AiInsights';
import IncomeExpenseChart from '../components/dashboard/IncomeExpenseChart';
import CategoryBreakdown from '../components/dashboard/CategoryBreakdown';
import ForecastCard from '../components/dashboard/ForecastCard';
import SpendingHeatmap from '../components/dashboard/SpendingHeatmap';
import GoalsWidget from '../components/dashboard/GoalsWidget';
import BudgetStatus from '../components/dashboard/BudgetStatus';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import TransactionForm from '../components/transactions/TransactionForm';
import Segmented from '../components/ui/Segmented';
import { CALENDAR_OPTIONS } from '../constants/options';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../hooks/useAction';
import { useFetch } from '../hooks/useFetch';
import { authService } from '../services/auth.service';
import { dashboardService } from '../services/dashboard.service';

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const { data, loading, error, reload } = useFetch(dashboardService.overview, [user?.calendar]);
  const { run, pending } = useAction();
  const [formOpen, setFormOpen] = useState(false);

  // The choice is saved on the user: every screen starts from it
  const changeCalendar = async (calendar) => {
    const { ok, result } = await run(() => authService.updateProfile({ calendar }));
    if (ok) setUser(result.user);
  };

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title={`שלום ${user?.name?.split(' ')[0] || ''} 👋`}
        subtitle={`סקירת מצב משק הבית שלך לחודש ${data.period.name}`}
      >
        <Segmented label="לוח שנה" options={CALENDAR_OPTIONS} value={user?.calendar || 'gregorian'} disabled={pending || loading} onChange={changeCalendar} />
        <Button icon={Plus} onClick={() => setFormOpen(true)}>
          עסקה חדשה
        </Button>
      </PageHeader>

      <div className="space-y-6">
        <SummaryCards summary={data.summary} />

        <div className="grid gap-6 lg:grid-cols-2">
          <HealthScore health={data.health} />
          <AiInsights />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <IncomeExpenseChart monthly={data.monthly} />
          <CategoryBreakdown categories={data.categories} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <ForecastCard forecast={data.forecast} upcoming={data.upcomingRecurring} />
          <GoalsWidget goals={data.goals} plan={data.savingsPlan} />
          <SpendingHeatmap heatmap={data.heatmap} period={data.period} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <RecentTransactions transactions={data.recent} onAdd={() => setFormOpen(true)} />
          <BudgetStatus budgets={data.budgets} />
        </div>
      </div>

      <TransactionForm open={formOpen} transaction={null} onClose={() => setFormOpen(false)} onSaved={reload} />
    </>
  );
}
