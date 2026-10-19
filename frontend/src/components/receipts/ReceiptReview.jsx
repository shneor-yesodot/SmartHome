import { useState } from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { useCategories } from '../../context/CategoriesContext';
import { formatMoney, toInputDate } from '../../utils/format';

let rowId = 0;
// From the receipts list the category arrives populated ({ id, name }); the form needs the id
const withKey = (item) => ({ ...item, category: item.category?.id || item.category || null, key: `row-${(rowId += 1)}` });

/** The user checks and fixes what the AI read, before anything is saved. */
export default function ReceiptReview({ receipt, previewUrl, saving, onConfirm, onCancel }) {
  const { byType } = useCategories();
  const categories = byType('expense');
  const [merchant, setMerchant] = useState(receipt.merchant || '');
  const [date, setDate] = useState(toInputDate(receipt.purchaseDate));
  const [items, setItems] = useState(() => receipt.items.map(withKey));

  const update = (key, field, value) => setItems((list) => list.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  const remove = (key) => setItems((list) => list.filter((i) => i.key !== key));
  const add = () => setItems((list) => [...list, withKey({ name: '', quantity: 1, total: '', category: categories[0]?.id || null })]);

  const total = items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
  const valid = items.length > 0 && date && items.every((i) => i.name.trim() && Number(i.total) > 0 && Number(i.quantity) > 0);

  const submit = (e) => {
    e.preventDefault();
    onConfirm({
      merchant,
      date,
      items: items.map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity), total: Number(i.total), category: i.category || null })),
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="card h-fit p-4">
        {previewUrl ? (
          <img src={previewUrl} alt="הקבלה שהועלתה" className="max-h-[420px] w-full rounded-xl object-contain" />
        ) : (
          <p className="rounded-xl bg-surface px-3 py-10 text-center text-sm text-ink-muted">{receipt.originalName}</p>
        )}
        <div className="mt-4 space-y-3">
          <Field label="בית עסק">
            <Input maxLength={80} value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          </Field>
          <Field label="תאריך הקנייה">
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </aside>

      <section className="card overflow-hidden">
        {receipt.engine === 'demo' && (
          <p className="flex items-start gap-2 border-b border-warn-500/30 bg-warn-50 px-5 py-3 text-sm text-warn-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            מצב הדגמה: בשרת לא הוגדר מפתח Gemini, ולכן מוצגים מוצרים לדוגמה ולא תוכן הקבלה שהעליתם.
          </p>
        )}
        <header className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="font-bold">זוהו {items.length} מוצרים</h2>
            <p className="text-sm text-ink-muted">בדקו ותקנו לפי הצורך. כל שורה תישמר כעסקה נפרדת.</p>
          </div>
          <Button variant="secondary" size="sm" icon={Plus} onClick={add}>
            שורה
          </Button>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px]">
            <thead className="border-y border-line bg-surface/60">
              <tr>
                <th className="table-head">מוצר</th>
                <th className="table-head w-20">כמות</th>
                <th className="table-head w-28">סכום (₪)</th>
                <th className="table-head w-44">קטגוריה</th>
                <th className="table-head w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item) => (
                <tr key={item.key}>
                  <td className="px-4 py-2">
                    <Input required maxLength={120} value={item.name} onChange={(e) => update(item.key, 'name', e.target.value)} aria-label="שם המוצר" />
                  </td>
                  <td className="px-2 py-2">
                    <Input type="number" min="0.001" step="any" required value={item.quantity} onChange={(e) => update(item.key, 'quantity', e.target.value)} aria-label="כמות" />
                  </td>
                  <td className="px-2 py-2">
                    <Input type="number" min="0.01" step="0.01" required value={item.total} onChange={(e) => update(item.key, 'total', e.target.value)} aria-label="סכום" />
                  </td>
                  <td className="px-2 py-2">
                    <Select value={item.category || ''} onChange={(e) => update(item.key, 'category', e.target.value)} aria-label="קטגוריה">
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <button type="button" className="icon-btn hover:!bg-danger-50 hover:!text-danger-500" onClick={() => remove(item.key)} aria-label={`הסרת ${item.name || 'השורה'}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <p className="text-sm text-ink-soft">
            סה״כ: <b className="tabular text-lg text-ink">{formatMoney(total)}</b>
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>
              ביטול
            </Button>
            <Button type="submit" loading={saving} disabled={!valid}>
              שמירת {items.length} עסקאות
            </Button>
          </div>
        </footer>
      </section>
    </form>
  );
}
