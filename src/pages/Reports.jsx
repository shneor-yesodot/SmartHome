import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, TrendingUp, TrendingDown, PiggyBank, Percent } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { formatCurrency, monthName } from '@/lib/format';
import PageLoader from '@/components/common/PageLoader';
import EmptyState from '@/components/common/EmptyState';

const COLORS = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#06b6d4', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#ec4899'];

function inMonth(txns, year, month) {
  return txns.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export default function Reports() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  useEffect(() => {
    base44.entities.Transaction.list('-date', 1000).then((t) => {
      setTransactions(t);
      setLoading(false);
    });
  }, []);

  const monthTxns = useMemo(() => inMonth(transactions, year, month), [transactions, year, month]);
  const prevTxns = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return inMonth(transactions, d.getFullYear(), d.getMonth());
  }, [transactions, year, month]);

  const income = monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings = income - expense;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  const prevIncome = prevTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const prevExpense = prevTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const categoryData = useMemo(() => {
    const map = {};
    monthTxns.filter((t) => t.type === 'expense').forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthTxns]);

  const dailyData = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, amount: 0 }));
    monthTxns.filter((t) => t.type === 'expense').forEach((t) => {
      const d = new Date(t.date).getDate();
      days[d - 1].amount += t.amount;
    });
    return days;
  }, [monthTxns, year, month]);

  const changePct = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const goPrev = () => {
    const d = new Date(year, month - 1, 1);
    setMonth(d.getMonth()); setYear(d.getFullYear());
  };
  const goNext = () => {
    const d = new Date(year, month + 1, 1);
    setMonth(d.getMonth()); setYear(d.getFullYear());
  };

  if (loading) return <PageLoader />;

  const monthLabel = `${monthName(new Date(year, month, 1))} ${year}`;

  const StatCard = ({ icon: Icon, label, value, prev, positive }) => {
    const diff = changePct(value, prev);
    const up = diff > 0;
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground font-medium">{label}</span>
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
        <p className="font-heading font-extrabold text-2xl">{formatCurrency(value)}</p>
        {prev > 0 && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${up === positive ? 'text-primary' : 'text-destructive'}`}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(diff)}% מול החודש הקודם
          </p>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev}><ChevronRight className="w-4 h-4" /></Button>
          <span className="font-heading font-bold text-lg min-w-[140px] text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={goNext}><ChevronLeft className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="הכנסות" value={income} prev={prevIncome} positive />
        <StatCard icon={TrendingDown} label="הוצאות" value={expense} prev={prevExpense} positive={false} />
        <StatCard icon={PiggyBank} label="חיסכון" value={savings} prev={prevIncome - prevExpense} positive />
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground font-medium">אחוז חיסכון</span>
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <Percent className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className={`font-heading font-extrabold text-2xl ${savingsRate >= 0 ? 'text-primary' : 'text-destructive'}`}>{savingsRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">מתוך ההכנסות</p>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-heading font-bold text-base mb-4">הוצאות יומיות� — {monthLabel}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                formatter={(v) => [formatCurrency(v), 'הוצאות']}
                contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', fontFamily: 'Heebo' }}
                labelStyle={{ fontWeight: 700 }}
                labelFormatter={(d) => `יום ${d}`}
              />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-heading font-bold text-base mb-4">פירוט הוצאות לפי קטגוריה</h3>
        {categoryData.length === 0 ? (
          <EmptyState icon={TrendingDown} title="אין הוצאות בחודש זה" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-right font-medium py-3">קטגוריה</th>
                  <th className="text-right font-medium py-3">סכום</th>
                  <th className="text-right font-medium py-3">אחוז</th>
                  <th className="py-3 w-32">נתח</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.map((c, i) => {
                  const pct = expense > 0 ? (c.value / expense) * 100 : 0;
                  return (
                    <tr key={c.name} className="border-b border-border last:border-0">
                      <td className="py-3">
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          {c.name}
                        </span>
                      </td>
                      <td className="py-3 font-semibold">{formatCurrency(c.value)}</td>
                      <td className="py-3 text-muted-foreground">{Math.round(pct)}%</td>
                      <td className="py-3">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}