import { useEffect } from 'react';
import { CreditCard, ShoppingBasket } from 'lucide-react';
import Badge from '../ui/Badge';
import { useFetch } from '../../hooks/useFetch';
import { transactionService } from '../../services/transaction.service';
import { formatDate, formatMoney } from '../../utils/format';

/** Everything bought together with this item, and whether the card charge was found for it. */
export default function PurchaseItems({ transaction, onLoad }) {
  const { data, loading } = useFetch(() => transactionService.purchase(transaction.id), [transaction.id]);

  useEffect(() => {
    if (data) onLoad?.(data.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading && !data) return <p className="h-24 animate-pulse rounded-xl bg-surface" aria-label="טוען את הקנייה" />;
  if (!data) return null;

  return (
    <section className="rounded-xl border border-line" aria-label="הקנייה כולה">
      <header className="space-y-1 border-b border-line px-3.5 py-3">
        <p className="flex items-center justify-between gap-3 text-sm font-semibold">
          <span className="flex min-w-0 items-center gap-1.5">
            <ShoppingBasket className="h-4 w-4 shrink-0 text-brand-500" />
            <span className="truncate">
              הקנייה כולה{data.merchant ? ` ב${data.merchant}` : ''} · {data.items.length} פריטים
            </span>
          </span>
          <b className="tabular shrink-0">{formatMoney(data.total)}</b>
        </p>
        <p className="tabular flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          <span>{formatDate(data.date)}</span>
          {data.account && (
            <span className="inline-flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" />
              {data.account.name}
              {data.chargeDate && `, חיוב ${formatDate(data.chargeDate)}`}
            </span>
          )}
          {data.matched ? (
            <Badge tone="success" className="!px-2 !py-0.5">
              מקושרת לשורה בדף שיובא
            </Badge>
          ) : (
            <span>שורת החיוב עוד לא יובאה</span>
          )}
        </p>
      </header>
      <ul className="max-h-56 divide-y divide-line overflow-y-auto">
        {data.items.map((item) => (
          <li key={item.id} className={`flex items-center justify-between gap-3 px-3.5 py-2 text-sm ${item.id === transaction.id ? 'bg-brand-50/70 font-semibold' : ''}`}>
            <span className="min-w-0">
              <span className="block truncate">{item.description}</span>
              <span className="tabular block text-xs font-normal text-ink-muted">
                {item.category?.name}
                {item.productName && item.quantity !== 1 && ` · ${item.quantity} × ${formatMoney(item.unitPrice)}`}
              </span>
            </span>
            <span className="tabular shrink-0">{formatMoney(item.amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
