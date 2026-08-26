import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export default function MonthlyChart({ data }) {
  return (
    <Card className="p-5">
      <h3 className="font-heading font-bold text-base mb-4">הכנסות מול הוצאות — 6 חודשים אחרונים</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent))', opacity: 0.4 }} />
            <Bar dataKey="income" name="הכנסות" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="expense" name="הוצאות" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}