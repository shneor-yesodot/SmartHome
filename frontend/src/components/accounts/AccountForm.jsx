import { useState } from 'react';
import clsx from 'clsx';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { useAction } from '../../hooks/useAction';
import { accountService } from '../../services/account.service';
import { ACCOUNT_KIND_LABELS, COLORS } from '../../constants/options';

export default function AccountForm({ open, account, onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title={account ? 'עריכת אמצעי תשלום' : 'אמצעי תשלום חדש'}>
      {open && <FormBody key={account?.id || 'new'} account={account} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function FormBody({ account, onClose, onSaved }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    name: account?.name || '',
    kind: account?.kind || 'credit',
    last4: account?.last4 || '',
    issuer: account?.issuer || '',
    billingDay: account?.billingDay ?? '',
    color: account?.color || COLORS[1],
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const isCard = form.kind === 'credit';

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      kind: form.kind,
      color: form.color,
      issuer: isCard ? form.issuer : '',
      billingDay: isCard && form.billingDay ? Number(form.billingDay) : null,
      last4: form.last4,
    };
    const { ok } = await run(
      () => (account ? accountService.update(account.id, payload) : accountService.create(payload)),
      account ? 'נשמר' : 'נוסף'
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="שם">
          <Input required autoFocus maxLength={60} value={form.name} onChange={set('name')} placeholder="למשל: ויזה של הבית" />
        </Field>
        <Field label="סוג">
          <Select value={form.kind} onChange={set('kind')}>
            {Object.entries(ACCOUNT_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {isCard && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="4 ספרות אחרונות" hint="לזיהוי בדפי האשראי. לעולם לא מספר מלא">
              <Input dir="ltr" inputMode="numeric" maxLength={4} pattern="\d{4}" value={form.last4} onChange={set('last4')} placeholder="1234" />
            </Field>
            <Field label="יום חיוב בחודש" hint="מתי הכרטיס יורד מהעו״ש">
              <Input type="number" inputMode="numeric" min="1" max="31" value={form.billingDay} onChange={set('billingDay')} placeholder="10" />
            </Field>
          </div>
          <Field label="חברת האשראי">
            <Input maxLength={40} value={form.issuer} onChange={set('issuer')} placeholder="לא חובה" />
          </Field>
        </>
      )}

      <div>
        <span className="label">צבע</span>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`צבע ${color}`}
              aria-pressed={form.color === color}
              onClick={() => setForm((f) => ({ ...f, color }))}
              className={clsx('h-8 w-8 rounded-full', form.color === color && 'ring-2 ring-ink ring-offset-2')}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

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
