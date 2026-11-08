import { Trash2 } from 'lucide-react';
import { Input, Select } from '../ui/Field';

let rowId = 0;
export const newItem = (item = {}) => ({ name: '', quantity: 1, total: '', category: '', ...item, key: `item-${(rowId += 1)}` });

export const basketTotal = (items) => items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

/**
 * Product lines of one purchase, stacked so they fit the regular dialog width.
 * Every line becomes its own transaction.
 */
export default function BasketItems({ items, onChange, categories }) {
  const update = (key, field, value) => onChange(items.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  const remove = (key) => onChange(items.filter((i) => i.key !== key));

  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={item.key} className="rounded-xl border border-line p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-muted">מוצר {index + 1}</span>
            <button
              type="button"
              className="icon-btn h-8 w-8 hover:!bg-danger-50 hover:!text-danger-500"
              onClick={() => remove(item.key)}
              aria-label={`הסרת ${item.name || `מוצר ${index + 1}`}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <Input
            required
            maxLength={120}
            value={item.name}
            onChange={(e) => update(item.key, 'name', e.target.value)}
            placeholder="שם המוצר"
            aria-label="שם המוצר"
          />
          <div className="mt-2 grid grid-cols-[72px_104px_minmax(0,1fr)] gap-2">
            <Input
              type="number"
              min="0.001"
              step="any"
              required
              value={item.quantity}
              onChange={(e) => update(item.key, 'quantity', e.target.value)}
              aria-label="כמות"
              title="כמות"
            />
            <Input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={item.total}
              onChange={(e) => update(item.key, 'total', e.target.value)}
              placeholder="₪ 0.00"
              aria-label="סכום"
            />
            <Select value={item.category || ''} onChange={(e) => update(item.key, 'category', e.target.value)} aria-label="קטגוריה">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </li>
      ))}
    </ol>
  );
}
