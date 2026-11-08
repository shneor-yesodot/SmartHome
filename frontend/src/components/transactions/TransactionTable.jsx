import { Pencil, Trash2 } from 'lucide-react';
import CategoryIcon from '../ui/CategoryIcon';
import Badge from '../ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { SOURCE_LABELS } from '../../constants/options';
import { formatDate, formatMoney, formatTransactionAmount } from '../../utils/format';
import { formatDay } from '../../utils/hebrewDate';

/** The date in the calendar being used; a Hebrew view keeps the Gregorian date next to it. */
function DateCell({ date, calendar }) {
  if (calendar !== 'hebrew') return formatDate(date);
  return (
    <>
      <span className="block">{formatDay(date, 'hebrew')}</span>
      <span className="block text-xs text-ink-muted">{formatDate(date)}</span>
    </>
  );
}

function Meta({ t }) {
  return (
    <>
      {t.productName && (
        <span className="tabular">
          {t.quantity} יח׳ × {formatMoney(t.unitPrice)}
        </span>
      )}
      {t.account && (
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.account.color }} />
          {t.account.name}
        </span>
      )}
      {t.source !== 'manual' && <Badge className="!px-2 !py-0.5">{SOURCE_LABELS[t.source]}</Badge>}
      {t.isRefund && <Badge className="!px-2 !py-0.5">זיכוי</Badge>}
      {t.purchase && <Badge className="!px-2 !py-0.5">פריט מקנייה</Badge>}
    </>
  );
}

export default function TransactionTable({ transactions, onEdit, onDelete, calendar }) {
  const { user } = useAuth();
  const shown = calendar || user?.calendar;

  return (
    <>
      {/* Phones: one card per transaction, nothing to scroll sideways */}
      <ul className="divide-y divide-line sm:hidden">
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <CategoryIcon icon={t.category?.icon} color={t.category?.color} size={36} />
            <button type="button" className="min-w-0 flex-1 text-start" onClick={() => onEdit(t)} aria-label={`עריכת ${t.description}`}>
              <span className="block truncate text-sm font-semibold">{t.description}</span>
              <span className="tabular block truncate text-xs text-ink-muted">
                {shown === 'hebrew' ? formatDay(t.date, 'hebrew') : formatDate(t.date)} · {t.category?.name}
                {t.merchant && t.merchant !== t.description ? ` · ${t.merchant}` : ''}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted empty:hidden">
                <Meta t={t} />
              </span>
            </button>
            <span className={`tabular shrink-0 text-sm font-bold ${t.type === 'income' ? 'text-brand-600' : ''}`}>{formatTransactionAmount(t)}</span>
            <button className="icon-btn -me-2 shrink-0 hover:!bg-danger-50 hover:!text-danger-500" onClick={() => onDelete(t)} aria-label={`מחיקת ${t.description}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="relative hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-line bg-surface/60">
            <tr>
              <th className="table-head">תאריך</th>
              <th className="table-head">תיאור</th>
              <th className="table-head">קטגוריה</th>
              <th className="table-head">בית עסק</th>
              <th className="table-head">סכום</th>
              <th className="table-head w-24">
                <span className="sr-only">פעולות</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-surface/60">
                <td className="table-cell tabular whitespace-nowrap text-ink-soft">
                  <DateCell date={t.date} calendar={shown} />
                </td>
                <td className="table-cell">
                  <p className="font-medium">{t.description}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                    <Meta t={t} />
                  </div>
                </td>
                <td className="table-cell">
                  <span className="flex items-center gap-2">
                    <CategoryIcon icon={t.category?.icon} color={t.category?.color} size={30} />
                    <span className="whitespace-nowrap">{t.category?.name}</span>
                  </span>
                </td>
                <td className="table-cell text-ink-soft">{t.merchant || <span className="text-ink-muted">-</span>}</td>
                <td className={`table-cell tabular whitespace-nowrap font-semibold ${t.type === 'income' ? 'text-brand-600' : ''}`}>
                  {formatTransactionAmount(t)}
                </td>
                <td className="table-cell">
                  <div className="flex justify-end gap-1">
                    <button className="icon-btn" onClick={() => onEdit(t)} aria-label={`עריכת ${t.description}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="icon-btn hover:!bg-danger-50 hover:!text-danger-500" onClick={() => onDelete(t)} aria-label={`מחיקת ${t.description}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
