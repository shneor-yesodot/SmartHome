import { useState } from 'react';
import clsx from 'clsx';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { useAction } from '../../hooks/useAction';
import { goalService } from '../../services/goal.service';
import { formatDate, formatMoney, formatSigned } from '../../utils/format';

export default function DepositForm({ goal, onClose, onSaved }) {
  return (
    <Modal open={Boolean(goal)} onClose={onClose} title={`הפקדה ליעד: ${goal?.name || ''}`} size="sm">
      {goal && <FormBody key={goal.id} goal={goal} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function FormBody({ goal, onClose, onSaved }) {
  const { run, pending } = useAction();
  const [mode, setMode] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const signed = mode === 'deposit' ? Number(amount) : -Number(amount);
    const { ok } = await run(() => goalService.deposit(goal.id, { amount: signed, note }), mode === 'deposit' ? 'ההפקדה נרשמה' : 'המשיכה נרשמה');
    if (ok) {
      onSaved();
      onClose();
    }
  };

  const recent = [...goal.deposits].reverse().slice(0, 4);

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-1">
        {[
          ['deposit', 'הפקדה'],
          ['withdraw', 'משיכה'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={clsx('rounded-lg py-2 text-sm font-semibold', mode === value ? 'bg-white text-ink shadow-card' : 'text-ink-muted')}
          >
            {label}
          </button>
        ))}
      </div>
      <Field label="סכום (₪)" hint={`נחסך עד כה: ${formatMoney(goal.currentAmount)}. נותרו ${formatMoney(goal.progress.remaining)} ליעד`}>
        <Input type="number" min="0.01" step="0.01" required autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="הערה">
        <Input maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="לא חובה" />
      </Field>

      {recent.length > 0 && (
        <div>
          <p className="label">תנועות אחרונות</p>
          <ul className="tabular space-y-1 text-sm">
            {recent.map((d, i) => (
              <li key={i} className="flex justify-between gap-3 text-ink-soft">
                <span className="truncate">
                  {formatDate(d.date)} {d.note && `, ${d.note}`}
                </span>
                <span className={d.amount < 0 ? 'text-danger-500' : 'text-brand-600'}>
                  {formatSigned(d.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
        <Button type="submit" loading={pending}>
          {mode === 'deposit' ? 'רישום הפקדה' : 'רישום משיכה'}
        </Button>
      </div>
    </form>
  );
}
