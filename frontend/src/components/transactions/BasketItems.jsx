import { Plus, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import { Input, Select } from '../ui/Field';
import { formatMoney } from '../../utils/format';

let rowId = 0;
export const newItem = (item = {}) => ({ name: '', quantity: 1, total: '', category: '', ...item, key: `item-${(rowId += 1)}` });

export const basketTotal = (items) => items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

/** Editable product lines of one purchase. Every line becomes its own transaction. */
export default function BasketItems({ items, onChange, categories, defaultCategory }) {
  const update = (key, field, value) => onChange(items.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  const remove = (key) => onChange(items.filter((i) => i.key !== key));
  const add = () => onChange([...items, newItem({ category: defaultCategory })]);

  return (
    <div className="rounded-xl border border-line">
      <div className="hidden grid-cols-[1fr_72px_104px_150px_36px] gap-2 border-b border-line bg-surface/60 px-3 py-2 text-xs font-semibold text-ink-soft sm:grid">
        <span>מוצר</span>
        <span>כמות</span>
        <span>סכום (₪)</span>
        <span>קטגוריה</span>
        <span />
      </div>

      <ul className="divide-y divide-line">
        {items.map((item, index) => (
          <li key={item.key} className="grid grid-cols-[1fr_1fr_36px] gap-2 p-3 sm:grid-cols-[1fr_72px_104px_150px_36px] sm:items-center">
            <Input
              required
              maxLength={120}
              value={item.name}
              onChange={(e) => update(item.key, 'name', e.target.value)}
              placeholder={index === 0 ? 'למשל: חלב 3%' : 'שם המוצר'}
              aria-label="שם המוצר"
              className="col-span-3 sm:col-span-1"
            />
            <Input
              type="number"
              min="0.001"
              step="any"
              required
              value={item.quantity}
              onChange={(e) => update(item.key, 'quantity', e.target.value)}
              aria-label="כמות"
            />
            <Input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={item.total}
              onChange={(e) => update(item.key, 'total', e.target.value)}
              placeholder="0.00"
              aria-label="סכום"
            />
            <Select
              value={item.category || ''}
              onChange={(e) => update(item.key, 'category', e.target.value)}
              aria-label="קטגוריה"
              className="col-span-2 sm:col-span-1"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <button
              type="button"
              className="icon-btn hover:!bg-danger-50 hover:!text-danger-500 disabled:opacity-40"
              onClick={() => remove(item.key)}
              disabled={items.length === 1}
              aria-label={`הסרת ${item.name || 'המוצר'}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5">
        <Button variant="ghost" size="sm" icon={Plus} onClick={add}>
          מוצר נוסף
        </Button>
        <p className="text-sm text-ink-soft">
          {items.length} מוצרים · סה״כ <b className="tabular text-base text-ink">{formatMoney(basketTotal(items))}</b>
        </p>
      </div>
    </div>
  );
}
