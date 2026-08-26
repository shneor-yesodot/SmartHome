import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';

const COLORS = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#06b6d4', '#3b82f6', '#a855f7', '#f59e0b'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
      <p className="font-semibold">{payload[0].payload.name}</p>
      <p className="text-muted-foreground">{formatCurrency(payload[0].payload.value)}</p>
    </div>
  );
};

export default function CategoryChart({ data }) {
  if (!data.length) {
    return (
      <Card className="p-5 flex items-center justify-center h-80 text-sm text-muted-foreground">
        אין הוצאות להצגה החודש
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <h3 className="font-heading font-bold text-base mb-4">פילוח הוצאות לפי קטגוריה</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 space-y-2">
        {data.slice(0, 5).map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {d.name}
            </span>
            <span className="font-semibold">{formatCurrency(d.value)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}