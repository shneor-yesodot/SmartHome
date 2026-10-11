import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { useCategories } from '../../context/CategoriesContext';
import { useAction } from '../../hooks/useAction';
import { budgetService } from '../../services/budget.service';

export default function BudgetForm({ open, budget, takenCategoryIds, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title={budget ? 'עריכת תקציב' : 'תקציב חדש'} size="sm">
      {open && <FormBody key={budget?.id || 'new'} budget={budget} takenCategoryIds={takenCategoryIds} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function FormBody({ budget, takenCategoryIds, onClose, onSaved }) {
  const { byType } = useCategories();
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    category: budget?.category.id || '',
    amount: budget?.amount ?? '',
    alertThreshold: budget?.alertThreshold ?? 80,
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const available = byType('expense').filter((c) => !takenCategoryIds.includes(c.id));

  const submit = async (e) => {
    e.preventDefault();
    const values = { amount: Number(form.amount), alertThreshold: Number(form.alertThreshold) };
    const { ok } = await run(
      () => (budget ? budgetService.update(budget.id, values) : budgetService.create({ ...values, category: form.category })),
      budget ? 'התקציב עודכן' : 'התקציב נוסף'
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {budget ? (
        <p className="text-sm text-ink-soft">
          קטגוריה: <b className="text-ink">{budget.category.name}</b>
        </p>
      ) : (
        <Field label="קטגוריה" hint={available.length ? undefined : 'לכל קטגוריות ההוצאה כבר הוגדר תקציב'}>
          <Select required value={form.category} onChange={set('category')}>
            <option value="" disabled>
              בחירת קטגוריה
            </option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="תקציב חודשי (₪)">
        <Input type="number" min="1" step="1" required value={form.amount} onChange={set('amount')} />
      </Field>
      <Field label={`התראה כשמנצלים ${form.alertThreshold}% מהתקציב`}>
        <input type="range" min="50" max="100" step="5" className="w-full accent-brand-500" value={form.alertThreshold} onChange={set('alertThreshold')} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
        <Button type="submit" loading={pending}>
          שמירת תקציב
        </Button>
      </div>
    </form>
  );
}
