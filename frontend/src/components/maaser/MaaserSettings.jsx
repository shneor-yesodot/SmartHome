import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Segmented from '../ui/Segmented';
import { Field, Input } from '../ui/Field';
import { useAction } from '../../hooks/useAction';
import { maaserService } from '../../services/maaser.service';
import { toInputDate } from '../../utils/format';

const MODES = [
  { value: 'percent', label: 'אחוז מההכנסות' },
  { value: 'fixed', label: 'סכום קבוע' },
];

/** How the monthly target is set, and from when the balance is tracked. */
export default function MaaserSettings({ settings, onSaved }) {
  const [form, setForm] = useState(() => ({ ...settings, startDate: toInputDate(settings.startDate) }));
  const { run, pending } = useAction();
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const changed = ['mode', 'percent', 'amount'].some((k) => String(form[k]) !== String(settings[k])) || form.startDate !== toInputDate(settings.startDate);

  const save = async (e) => {
    e.preventDefault();
    const { ok } = await run(
      () => maaserService.updateSettings({ mode: form.mode, percent: Number(form.percent), amount: Number(form.amount), startDate: form.startDate }),
      'הגדרות המעשרות נשמרו'
    );
    if (ok) onSaved();
  };

  return (
    <Card title="הגדרת היעד" icon={Settings2}>
      <form onSubmit={save} className="space-y-4">
        <Segmented label="אופן החישוב" options={MODES} value={form.mode} onChange={(mode) => setForm((f) => ({ ...f, mode }))} />
        <div className="grid grid-cols-2 gap-3">
          {form.mode === 'percent' ? (
            <Field label="אחוז מההכנסות" hint="למשל 10 למעשר, 20 לחומש">
              <Input type="number" min="1" max="100" step="0.5" required value={form.percent} onChange={set('percent')} />
            </Field>
          ) : (
            <Field label="סכום חודשי (₪)">
              <Input type="number" min="0" step="1" required value={form.amount} onChange={set('amount')} />
            </Field>
          )}
          <Field label="מעקב מתאריך" hint="יתרה מצטברת נספרת מכאן">
            <Input type="date" required value={form.startDate} onChange={set('startDate')} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={pending} disabled={!changed}>
            שמירה
          </Button>
        </div>
      </form>
    </Card>
  );
}
