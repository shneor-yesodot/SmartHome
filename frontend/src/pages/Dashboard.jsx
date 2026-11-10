import { useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { ErrorState, PageLoader } from '../components/ui/States';
import SummaryCards from '../components/dashboard/SummaryCards';
import ForecastCard from '../components/dashboard/ForecastCard';
import BudgetStatus from '../components/dashboard/BudgetStatus';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import TransactionForm from '../components/transactions/TransactionForm';
import AddButtons from '../components/transactions/AddButtons';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { dashboardService } from '../services/dashboard.service';

/**
 * The home screen answers three questions: how much is left this month, where is it
 * over budget, and what happened lately. Charts and analysis live in Reports.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(dashboardService.overview, [user?.calendar]);
  const [adding, setAdding] = useState(null); // 'expense' | 'income' | null

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  return (
    <>
      <PageHeader title={`שלום ${user?.name?.split(' ')[0] || ''} 👋`} subtitle={`מה קורה החודש, ${data.period.label}`}>
        <AddButtons onAdd={setAdding} />
      </PageHeader>

      <div className="space-y-6">
        <SummaryCards summary={data.summary} />

        <div className="grid gap-6 lg:grid-cols-2">
          <ForecastCard forecast={data.forecast} upcoming={data.upcomingRecurring} />
          <BudgetStatus budgets={data.budgets} />
        </div>

        <RecentTransactions transactions={data.recent} onAdd={() => setAdding('expense')} />
      </div>

      <TransactionForm open={Boolean(adding)} transaction={null} mode={adding || 'expense'} onClose={() => setAdding(null)} onSaved={reload} />
    </>
  );
}
