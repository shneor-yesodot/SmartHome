import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { todayISO } from '@/lib/format';
import { checkBudgetAlerts } from '@/lib/budgetAlerts';
import { Loader2 } from 'lucide-react';

const empty = { type: 'expense', amount: '', category: '', description: '', merchant: '', date: todayISO(), notes: '' };

export default function TransactionForm({ open, onClose, onSaved, editingTransaction, categories }) {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingTransaction) {
      setForm({
        type: editingTransaction.type || 'expense',
        amount: String(editingTransaction.amount || ''),
        category: editingTransaction.category || '',
        description: editingTransaction.description || '',
        merchant: editingTransaction.merchant || '',
        date: editingTransaction.date || todayISO(),
        notes: editingTransaction.notes || '',
      });
    } else {
      setForm(empty);
    }
  }, [editingTransaction, open]);

  const availableCategories = (categories || []).filter((c) => c.type === form.type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form, amount: Number(form.amount) };
    try {
      if (editingTransaction) {
        await base44.entities.Transaction.update(editingTransaction.id, payload);
        await checkBudgetAlerts({ ...payload, category: editingTransaction.category });
      } else {
        const created = await base44.entities.Transaction.create(payload);
        await checkBudgetAlerts(created);
      }
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingTransaction ? 'עריכת עסקה' : 'הוספת עסקה'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'expense', category: '' })}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                form.type === 'expense'
                  ? 'bg-destructive text-destructive-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              הוצאה
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'income', category: '' })}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                form.type === 'income'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              הכנסה
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">סכום (₪)</Label>
            <Input
              id="amount" type="number" step="0.01" min="0" required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>קטגוריה</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
              <SelectContent>
                {availableCategories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור מוצר / פעולה</Label>
            <Input
              id="description" required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="לדוגמה: חלב תנובה 2%"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="merchant">בית עסק</Label>
            <Input
              id="merchant"
              value={form.merchant}
              onChange={(e) => setForm({ ...form, merchant: e.target.value })}
              placeholder="לדוגמה: שופרסל"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">תאריך</Label>
              <Input
                id="date" type="date" required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">הערה</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="אופציונלי"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
              שמור
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}