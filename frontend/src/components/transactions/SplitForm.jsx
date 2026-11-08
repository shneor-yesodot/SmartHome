import { useState } from 'react';
import { Plus } from 'lucide-react';
import Button from '../ui/Button';
import BasketItems, { basketTotal, newItem } from './BasketItems';
import { useCategories } from '../../context/CategoriesContext';
import { useAction } from '../../hooks/useAction';
import { transactionService } from '../../services/transaction.service';
import { formatMoney } from '../../utils/format';

const round2 = (n) => Math.round(n * 100) / 100;

/** Breaks one purchase, usually a statement line, into items. Their total must equal the purchase. */
export default function SplitForm({ transaction, onBack, onDone }) {
  const { byType } = useCategories();
  const { run, pending } = useAction();
  const category = transaction.category?.id || '';
  const [items, setItems] = useState(() => [newItem({ category }), newItem({ category })]);
  const left = round2(transaction.amount - basketTotal(items));

  // The last item takes what is left, for what was not worth listing
  const addRest = () => setItems((list) => [...list, newItem({ category, name: 'שאר הקנייה', total: left })]);

  const submit = async (e) => {
    e.preventDefault();
    const payload = items.map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity) || 1, total: Number(i.total), category: i.category || null }));
    const { ok } = await run(() => transactionService.split(transaction.id, payload), `העסקה פוצלה ל-${items.length} פריטים`);
    if (ok) onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="tabular text-sm text-ink-soft">
        {transaction.merchant || transaction.description} · סה״כ <b className="text-ink">{formatMoney(transaction.amount)}</b>
      </p>

      <BasketItems items={items} onChange={setItems} categories={byType('expense')} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setItems((list) => [...list, newItem({ category })])}>
            מוצר נוסף
          </Button>
          {left > 0 && (
            <Button variant="secondary" size="sm" onClick={addRest}>
              הוספת השאר כפריט
            </Button>
          )}
        </div>
        <p role="status" className={`tabular text-sm font-semibold ${left === 0 ? 'text-brand-600' : 'text-warn-600'}`}>
          {left === 0 ? 'הסכום מתאים' : left > 0 ? `נשאר לחלק: ${formatMoney(left)}` : `חריגה של ${formatMoney(-left)}`}
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onBack}>
          חזרה
        </Button>
        <Button type="submit" loading={pending} disabled={left !== 0 || items.length < 2}>
          פיצול ל-{items.length} פריטים
        </Button>
      </div>
    </form>
  );
}
