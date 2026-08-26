import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, RefreshCw, Zap, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate, todayISO } from '@/lib/format';
import PageLoader from '@/components/common/PageLoader';
import EmptyState from '@/components/common/EmptyState';
import { toast } from '@/components/ui/use-toast';

const FREQ_LABELS = { daily: 'יומי', weekly: 'שבועי', monthly: 'חודשי', yearly: 'שנתי' };

function nextDate(dateStr, freq) {
  const d = new Date(dateStr);
  if (freq === 'daily') d.setDate(d.getDate() + 1);
  if (freq === 'weekly') d.setDate(d.getDate() + 7);
  if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Recurring() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(null);
  const [form, setForm] = useState({
    description: '', amount: '', category: '', type: 'expense',
    frequency: 'monthly', next_execution: todayISO(), is_active: true,
  });

  const load = async () => {
    const [items_, cats] = await Promise.all([
      base44.entities.RecurringPayment.list('-next_execution'),
      base44.entities.Category.list(),
    ]);
    setItems(items_);
    setCategories(cats);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ description: '', amount: '', category: '', type: 'expense', frequency: 'monthly', next_execution: todayISO(), is_active: true });
    setOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      description: r.description, amount: String(r.amount), category: r.category,
      type: r.type, frequency: r.frequency, next_execution: r.next_execution, is_active: r.is_active,
    });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, amount: Number(form.amount) };
    try {
      if (editing) await base44.entities.RecurringPayment.update(editing.id, payload);
      else await base44.entities.RecurringPayment.create(payload);
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r) => {
    await base44.entities.RecurringPayment.update(r.id, { is_active: !r.is_active });
    load();
  };

  const remove = async (r) => {
    if (!confirm(`למחוק "${r.description}"?`)) return;
    await base44.entities.RecurringPayment.delete(r.id);
    load();
  };

  const executeNow = async (r) => {
    setExecuting(r.id);
    try {
      await base44.entities.Transaction.create({
        type: r.type,
        amount: r.amount,
        category: r.category,
        description: r.description,
        date: todayISO(),
        is_recurring: true,
      });
      await base44.entities.RecurringPayment.update(r.id, {
        last_executed: todayISO(),
        next_execution: nextDate(r.next_execution, r.frequency),
      });
      toast({ title: 'העסקה בוצעה', description: `${r.description} — ${formatCurrency(r.amount)}` });
      load();
    } finally {
      setExecuting(null);
    }
  };

  if (loading) return <PageLoader />;

  const availableCategories = categories.filter((c) => c.type === form.type);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{items.filter((i) => i.is_active).length} הוראות קבע פעילות</p>
        <Button onClick={openCreate}><Plus className="w-4 h-4 ml-2" />הוראת קבע חדשה</Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={RefreshCw}
            title="אין הוראות קבע"
            description="הגדירו תשלומים חוזרים כדי להפוך אותם לעסקה בלחיצה"
            action={<Button onClick={openCreate}><Plus className="w-4 h-4 ml-2" />הוראת קבע חדשה</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((r) => (
            <Card key={r.id} className={`p-5 ${!r.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.type === 'income' ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                    <RefreshCw className={`w-5 h-5 ${r.type === 'income' ? 'text-primary' : 'text-destructive'}`} />
                  </div>
                  <div>
                    <p className="font-heading font-bold">{r.description}</p>
                    <p className="text-xs text-muted-foreground">{r.category} · {FREQ_LABELS[r.frequency]}</p>
                  </div>
                </div>
                <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
              </div>

              <div className="flex items-end justify-between mb-4">
                <span className={`text-2xl font-heading font-extrabold ${r.type === 'income' ? 'text-primary' : ''}`}>
                  {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount)}
                </span>
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">הביצוע הבא</p>
                  <p className="text-sm font-semibold">{formatDate(r.next_execution)}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => executeNow(r)} disabled={executing === r.id}>
                  {executing === r.id ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Zap className="w-4 h-4 ml-2" />}
                  בצע עכשיו
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(r)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'עריכת הוראת קבע' : 'הוראת קבע חדשה'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm({ ...form, type: 'expense', category: '' })}
                className={`py-2.5 rounded-xl text-sm font-semibold ${form.type === 'expense' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}`}>הוצאה</button>
              <button type="button" onClick={() => setForm({ ...form, type: 'income', category: '' })}
                className={`py-2.5 rounded-xl text-sm font-semibold ${form.type === 'income' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>הכנסה</button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rdesc">תיאור</Label>
              <Input id="rdesc" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="לדוגמה: שכר דירה" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ramount">סכום (₪)</Label>
                <Input id="ramount" type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>תדירות</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQ_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rdate">תאריך ביצוע הבא</Label>
              <Input id="rdate" type="date" required value={form.next_execution} onChange={(e) => setForm({ ...form, next_execution: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}שמור</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}