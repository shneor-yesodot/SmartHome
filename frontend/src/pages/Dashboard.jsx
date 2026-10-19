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
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { dashboardService } from '../services/dashboard.service';
import { HEBREW_MONTHS } from '../utils/format';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(dashboardService.overview, []);
  const [formOpen, setFormOpen] = useState(false);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title={`שלום ${user?.name?.split(' ')[0] || ''} 👋`}
        subtitle={`סקירת מצב משק הבית שלך לחודש ${HEBREW_MONTHS[data.period.month]}`}
      >
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
