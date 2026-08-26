import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Target, Loader2 } from 'lucide-react';
import { formatCurrency, isSameMonth, todayISO } from '@/lib/format';
import PageLoader from '@/components/common/PageLoader';
import EmptyState from '@/components/common/EmptyState';

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ category: '', amount: '', period: 'monthly', start_date: todayISO() });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [bdgs, txns, cats] = await Promise.all([
      base44.entities.Budget.list(),
      base44.entities.Transaction.list('-date', 500),
      base44.entities.Category.list(),
    ]);
    setBudgets(bdgs);
    setTransactions(txns);
    setCategories(cats.filter((c) => c.type === 'expense'));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ category: '', amount: '', period: 'monthly', start_date: todayISO() });
    setOpen(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({ category: b.category, amount: String(b.amount), period: b.period, start_date: b.start_date || todayISO() });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, amount: Number(form.amount) };
    try {
      if (editing) await base44.entities.Budget.update(editing.id, payload);
      else await base44.entities.Budget.create(payload);
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b) => {
    if (!confirm(`למחוק תקציב "${b.category}"?`)) return;
    await base44.entities.Budget.delete(b.id);
    load();
  };

  if (loading) return <PageLoader />;

  const monthExpenses = transactions.filter((t) => t.type === 'expense' && isSameMonth(t.date));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{budgets.length} תקציבים פעילים</p>
        <Button onClick={openCreate}><Plus className="w-4 h-4 ml-2" />תקציב חדש</Button>
      </div>

      {budgets.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="אין תקציבים מוגדרים"
            description="הגדירו תקציבים לקטגוריות כדי לעקוב אחרי ההוצאות שלכם"
            action={<Button onClick={openCreate}><Plus className="w-4 h-4 ml-2" />תקציב חדש</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((b) => {
            const spent = monthExpenses.filter((t) => t.category === b.category).reduce((s, t) => s + t.amount, 0);
            const pct = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0;
            const over = spent > b.amount;
            const remaining = b.amount - spent;
            return (
              <Card key={b.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${over ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                      <Target className={`w-5 h-5 ${over ? 'text-destructive' : 'text-primary'}`} />
                    </div>
                    <div>
                      <p className="font-heading font-bold">{b.category}</p>
                      <p className="text-xs text-muted-foreground">{b.period === 'monthly' ? 'חודשי' : 'שנתי'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-primary">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(b)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-heading font-extrabold">{formatCurrency(b.amount)}</span>
                  <span className={`text-sm font-semibold ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {over ? `חריגה ${formatCurrency(spent - b.amount)}` : `נותר ${formatCurrency(remaining)}`}
                  </span>
                </div>

                <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">נוצלו {formatCurrency(spent)} ({Math.round(pct)}%)</p>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'עריכת תקציב' : 'תקציב חדש'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bamount">סכום תקציב (₪)</Label>
              <Input id="bamount" type="number" min="0" required value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>תקופה</Label>
              <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">חודשי</SelectItem>
                  <SelectItem value="yearly">שנתי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                שמור
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}