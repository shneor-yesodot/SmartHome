import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, Plus, Target } from 'lucide-react';
import { formatCurrency, formatDate, isSameMonth, monthName } from '@/lib/format';
import PageLoader from '@/components/common/PageLoader';
import EmptyState from '@/components/common/EmptyState';
import SummaryCards from '@/components/dashboard/SummaryCards';
import MonthlyChart from '@/components/dashboard/MonthlyChart';
import CategoryChart from '@/components/dashboard/CategoryChart';

function buildMonthlyData(transactions) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: monthName(d).replace("'", ""), income: 0, expense: 0 });
  }
  transactions.forEach((t) => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = months.find((x) => x.key === key);
    if (m) m[t.type] = (m[t.type] || 0) + (t.amount || 0);
  });
  return months;
}

function buildCategoryData(transactions) {
  const map = {};
  transactions
    .filter((t) => t.type === 'expense' && isSameMonth(t.date))
    .forEach((t) => {
      map[t.category] = (map[t.category] || 0) + (t.amount || 0);
    });
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [txns, bdgs] = await Promise.all([
      base44.entities.Transaction.list('-date', 300),
      base44.entities.Budget.list(),
    ]);
    setTransactions(txns);
    setBudgets(bdgs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <PageLoader />;

  const monthTxns = transactions.filter((t) => isSameMonth(t.date));
  const income = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const monthlyData = buildMonthlyData(transactions);
  const categoryData = buildCategoryData(transactions);
  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading font-extrabold text-2xl">שלום 👋</h2>
          <p className="text-sm text-muted-foreground mt-1">סקירת מצב משק הבית שלך לחודש {monthName(new Date())}</p>
        </div>
        <Link to="/transactions">
          <Button><Plus className="w-4 h-4 ml-2" />עסקה חדשה</Button>
        </Link>
      </div>

      <SummaryCards income={income} expense={expense} balance={balance} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyChart data={monthlyData} />
        <CategoryChart data={categoryData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-base">עסקאות אחרונות</h3>
            <Link to="/transactions" className="text-sm text-primary hover:underline">הצג הכל</Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title="אין עסקאות עדיין" description="התחילו לתעד הוצאות והכנסות" />
          ) : (
            <div className="space-y-1">
              {recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                      <ArrowLeftRight className={`w-4 h-4 ${t.type === 'income' ? 'text-primary' : 'text-destructive'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.category} · {formatDate(t.date)}</p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm whitespace-nowrap ${t.type === 'income' ? 'text-primary' : 'text-foreground'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-base">מצב תקציבים</h3>
            <Link to="/budgets" className="text-sm text-primary hover:underline">נהל תקציבים</Link>
          </div>
          {budgets.length === 0 ? (
            <EmptyState icon={Target} title="אין תקציבים מוגדרים" description="הגדירו תקציבים כדי לעקוב אחרי ההוצאות" />
          ) : (
            <div className="space-y-4">
              {budgets.slice(0, 4).map((b) => {
                const spent = monthTxns
                  .filter((t) => t.category === b.category && t.type === 'expense')
                  .reduce((s, t) => s + t.amount, 0);
                const pct = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0;
                const over = spent > b.amount;
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium">{b.category}</span>
                      <span className={over ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                        {formatCurrency(spent)} / {formatCurrency(b.amount)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${over ? 'bg-destructive' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}