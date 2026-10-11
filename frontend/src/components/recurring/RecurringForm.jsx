import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import TypeToggle from '../ui/TypeToggle';
import { Field, Input, Select } from '../ui/Field';
import { useCategories } from '../../context/CategoriesContext';
import { useAction } from '../../hooks/useAction';
import { recurringService } from '../../services/recurring.service';
import { FREQUENCY_LABELS } from '../../constants/options';
import { toInputDate, todayInput } from '../../utils/format';

export default function RecurringForm({ open, payment, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title={payment ? 'עריכת הוראת קבע' : 'הוראת קבע חדשה'}>
      {open && <FormBody key={payment?.id || 'new'} payment={payment} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function FormBody({ payment, onClose, onSaved }) {
  const { byType } = useCategories();
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    type: payment?.type || 'expense',
    description: payment?.description || '',
    merchant: payment?.merchant || '',
    amount: payment?.amount ?? '',
    category: payment?.category?.id || '',
    frequency: payment?.frequency || 'monthly',
    startDate: payment ? toInputDate(payment.nextRun) : todayInput(),
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...form, amount: Number(form.amount) };
    const { ok } = await run(
      () => (payment ? recurringService.update(payment.id, payload) : recurringService.create(payload)),
      payment ? 'הוראת הקבע עודכנה' : 'הוראת הקבע נוספה'
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TypeToggle value={form.type} onChange={(type) => setForm((f) => ({ ...f, type, category: '' }))} />
      <Field label="תיאור">
        <Input required maxLength={140} autoFocus value={form.description} onChange={set('description')} placeholder="למשל: שכר דירה" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="סכום (₪)">
          <Input type="number" min="0.01" step="0.01" required value={form.amount} onChange={set('amount')} />
        </Field>
        <Field label="קטגוריה">
          <Select required value={form.category} onChange={set('category')}>
            <option value="" disabled>
              בחירת קטגוריה
            </option>
            {byType(form.type).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="תדירות">
          <Select value={form.frequency} onChange={set('frequency')}>
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="תאריך החיוב הבא">
          <Input type="date" required value={form.startDate} onChange={set('startDate')} />
        </Field>
      </div>
      <Field label="בית עסק / גורם משלם">
        <Input maxLength={80} value={form.merchant} onChange={set('merchant')} placeholder="לא חובה" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
        <Button type="submit" loading={pending}>
          שמירה
        </Button>
      </div>
    </form>
  );
}
