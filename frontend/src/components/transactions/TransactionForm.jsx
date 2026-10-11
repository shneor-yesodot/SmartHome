import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import TypeToggle from '../ui/TypeToggle';
import { Field, Input, Select } from '../ui/Field';
import { useCategories } from '../../context/CategoriesContext';
import { useAction } from '../../hooks/useAction';
import { transactionService } from '../../services/transaction.service';
import { toInputDate, todayInput } from '../../utils/format';

const toForm = (t) => ({
  type: t?.type || 'expense',
  amount: t?.amount ?? '',
  category: t?.category?.id || '',
  description: t?.description || '',
  merchant: t?.merchant || '',
  date: t ? toInputDate(t.date) : todayInput(),
  productName: t?.productName || '',
  quantity: t?.quantity ?? 1,
  notes: t?.notes || '',
});

/** Create / edit a transaction. `transaction` is null when creating. */
export default function TransactionForm({ open, transaction, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title={transaction ? 'עריכת עסקה' : 'עסקה חדשה'}>
      {/* The key resets the form state whenever a different transaction is opened */}
      {open && <FormBody key={transaction?.id || 'new'} transaction={transaction} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function FormBody({ transaction, onClose, onSaved }) {
  const { byType } = useCategories();
  const { run, pending } = useAction();
  const [form, setForm] = useState(() => toForm(transaction));
  const [showProduct, setShowProduct] = useState(Boolean(transaction?.productName));

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const categories = byType(form.type);

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      type: form.type,
      amount: Number(form.amount),
      category: form.category,
      description: form.description,
      merchant: form.merchant,
      date: form.date,
      notes: form.notes,
      productName: showProduct ? form.productName : '',
      ...(showProduct && form.productName ? { quantity: Number(form.quantity) || 1 } : {}),
    };
    const { ok } = await run(
      () => (transaction ? transactionService.update(transaction.id, payload) : transactionService.create(payload)),
      transaction ? 'העסקה עודכנה' : 'העסקה נוספה'
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TypeToggle value={form.type} onChange={(type) => setForm((f) => ({ ...f, type, category: '' }))} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="סכום (₪)">
          <Input type="number" inputMode="decimal" min="0.01" step="0.01" required autoFocus value={form.amount} onChange={set('amount')} placeholder="0.00" />
        </Field>
        <Field label="תאריך">
          <Input type="date" required value={form.date} onChange={set('date')} />
        </Field>
      </div>

      <Field label="תיאור">
        <Input required maxLength={140} value={form.description} onChange={set('description')} placeholder="למשל: קנייה שבועית" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="קטגוריה">
          <Select required value={form.category} onChange={set('category')}>
            <option value="" disabled>
              בחירת קטגוריה
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="בית עסק">
          <Input maxLength={80} value={form.merchant} onChange={set('merchant')} placeholder="לא חובה" />
        </Field>
      </div>

      {form.type === 'expense' && (
        <div className="rounded-xl border border-line p-3.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={showProduct} onChange={(e) => setShowProduct(e.target.checked)} />
            פירוט מוצר (למעקב מחירים)
          </label>
          {showProduct && (
            <div className="mt-3 grid grid-cols-[1fr_96px] gap-3">
              <Field label="שם המוצר">
                <Input maxLength={120} required value={form.productName} onChange={set('productName')} placeholder="למשל: חלב 3% 1 ליטר" />
              </Field>
              <Field label="כמות">
                <Input type="number" min="0.001" step="any" value={form.quantity} onChange={set('quantity')} />
              </Field>
            </div>
          )}
        </div>
      )}

      <Field label="הערות">
        <Input maxLength={500} value={form.notes} onChange={set('notes')} placeholder="לא חובה" />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
        <Button type="submit" loading={pending}>
          {transaction ? 'שמירת שינויים' : 'הוספת עסקה'}
        </Button>
      </div>
    </form>
  );
}
