import { ArrowDownRight, ArrowUpRight, Store } from 'lucide-react';
import CategoryIcon from '../ui/CategoryIcon';
import { formatChange, formatDate, formatMoney } from '../../utils/format';

/** Price went up = bad (red), went down = good (green). */
export function PriceChange({ value }) {
  if (value === null || value === undefined || Math.abs(value) < 0.5) return null;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`tabular inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-danger-500' : 'text-brand-600'}`} dir="ltr">
      <Icon className="h-3.5 w-3.5" />
      {formatChange(value)}
    </span>
  );
}

export default function ProductCard({ product, onOpen }) {
  const cheaperElsewhere = product.potentialSaving > 0;
  return (
    <button className="card p-4 text-start transition-colors hover:border-brand-300" onClick={() => onOpen(product)}>
      <div className="flex items-start gap-3">
        <CategoryIcon icon={product.category?.icon} color={product.category?.color} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{product.name}</h3>
          <p className="text-xs text-ink-muted">
            {product.purchases} קניות, אחרונה ב-{formatDate(product.lastDate)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-ink-muted">מחיר אחרון ({product.lastMerchant})</p>
          <p className="tabular flex items-center gap-2 text-xl font-extrabold">
            {formatMoney(product.lastPrice)}
            <PriceChange value={product.priceChange} />
          </p>
        </div>
      </div>

      <p className={`mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] ${cheaperElsewhere ? 'bg-brand-50 text-brand-700' : 'bg-surface text-ink-soft'}`}>
        <Store className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {product.merchantsCount < 2
            ? 'נקנה רק במקום אחד'
            : cheaperElsewhere
              ? `הכי משתלם: ${product.bestMerchant}, ${formatMoney(product.bestPrice)}`
              : `קניתם במקום הכי זול: ${product.bestMerchant}`}
        </span>
      </p>
    </button>
  );
}
