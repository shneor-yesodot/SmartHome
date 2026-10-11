import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { ColorPicker, IconPicker } from '../ui/Pickers';
import { useAction } from '../../hooks/useAction';
import { goalService } from '../../services/goal.service';
import { toInputDate, todayInput } from '../../utils/format';

export default function GoalForm({ open, goal, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title={goal ? 'עריכת יעד' : 'יעד חיסכון חדש'}>
      {open && <FormBody key={goal?.id || 'new'} goal={goal} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function FormBody({ goal, onClose, onSaved }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    name: goal?.name || '',
    targetAmount: goal?.targetAmount ?? '',
    initialAmount: '',
    targetDate: goal ? toInputDate(goal.targetDate) : '',
    icon: goal?.icon || 'PiggyBank',
    color: goal?.color || '#12A05C',
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const values = { name: form.name, targetAmount: Number(form.targetAmount), targetDate: form.targetDate, icon: form.icon, color: form.color };
    const { ok } = await run(
      () => (goal ? goalService.update(goal.id, values) : goalService.create({ ...values, initialAmount: Number(form.initialAmount) || 0 })),
      goal ? 'היעד עודכן' : 'היעד נוסף'
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="שם היעד">
        <Input required maxLength={60} autoFocus value={form.name} onChange={set('name')} placeholder="למשל: חופשה משפחתית" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="סכום היעד (₪)">
          <Input type="number" min="1" step="1" required value={form.targetAmount} onChange={set('targetAmount')} />
        </Field>
        <Field label="תאריך היעד">
          <Input type="date" required min={goal ? undefined : todayInput()} value={form.targetDate} onChange={set('targetDate')} />
        </Field>
      </div>
      {!goal && (
        <Field label="כבר נחסך (₪)" hint="לא חובה. סכום שכבר שמתם בצד ליעד הזה">
          <Input type="number" min="0" step="1" value={form.initialAmount} onChange={set('initialAmount')} placeholder="0" />
        </Field>
      )}
      <Field label="צבע">
        <ColorPicker value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
      </Field>
      <Field label="אייקון">
        <IconPicker value={form.icon} color={form.color} onChange={(icon) => setForm((f) => ({ ...f, icon }))} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
        <Button type="submit" loading={pending}>
          שמירת יעד
        </Button>
      </div>
    </form>
  );
}
