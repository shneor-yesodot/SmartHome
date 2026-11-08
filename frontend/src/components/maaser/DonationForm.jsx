import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { useAction } from '../../hooks/useAction';
import { maaserService } from '../../services/maaser.service';
import { todayInput } from '../../utils/format';

/** A donation: to whom, how much and when. `recipients` are earlier names, offered as suggestions. */
export default function DonationForm({ open, onClose, onSaved, recipients = [] }) {
  return (
    <Modal open={open} onClose={onClose} title="תרומה חדשה">
      {open && <FormBody onClose={onClose} onSaved={onSaved} recipients={recipients} />}
    </Modal>
  );
}

function FormBody({ onClose, onSaved, recipients }) {
  const [form, setForm] = useState({ recipient: '', amount: '', date: todayInput(), notes: '' });
  const { run, pending } = useAction();
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const { ok } = await run(
      () => maaserService.addDonation({ ...form, recipient: form.recipient.trim(), amount: Number(form.amount) }),
      'התרומה נרשמה'
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="למי ניתן">
        <Input required autoFocus maxLength={80} list="maaser-recipients" value={form.recipient} onChange={set('recipient')} placeholder="למשל: קופת העיר" />
        <datalist id="maaser-recipients">
          {recipients.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="סכום (₪)">
          <Input type="number" inputMode="decimal" min="0.01" step="0.01" required value={form.amount} onChange={set('amount')} placeholder="0.00" />
        </Field>
        <Field label="תאריך">
          <Input type="date" required value={form.date} onChange={set('date')} />
        </Field>
      </div>
      <Field label="הערות">
        <Input maxLength={500} value={form.notes} onChange={set('notes')} placeholder="לא חובה" />
      </Field>
      <p className="text-xs text-ink-muted">התרומה נשמרת גם כהוצאה בקטגוריה ״צדקה ומעשרות״, כך שהיא נספרת במאזן ובדוחות.</p>
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
