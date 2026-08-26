import React from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

const Card = ({ icon: Icon, label, value, tone }) => (
  <div className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone.bg}`}>
        <Icon className={`w-5 h-5 ${tone.text}`} />
      </div>
    </div>
    <p className={`font-heading font-extrabold text-2xl ${tone.value}`}>{formatCurrency(value)}</p>
  </div>
);

export default function SummaryCards({ income, expense, balance }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card
        icon={TrendingUp} label="הכנסות החודש" value={income}
        tone={{ bg: 'bg-primary/10', text: 'text-primary', value: 'text-primary' }}
      />
      <Card
        icon={TrendingDown} label="הוצאות החודש" value={expense}
        tone={{ bg: 'bg-destructive/10', text: 'text-destructive', value: 'text-destructive' }}
      />
      <Card
        icon={Wallet} label="יתרה נוכחית" value={balance}
        tone={{ bg: 'bg-accent', text: 'text-accent-foreground', value: 'text-foreground' }}
      />
    </div>
  );
}