import { Pencil, Trash2 } from 'lucide-react';
import CategoryIcon from '../ui/CategoryIcon';
import Badge from '../ui/Badge';
import { SOURCE_LABELS } from '../../constants/options';
import { formatDate, formatMoney, formatTransactionAmount } from '../../utils/format';

export default function TransactionTable({ transactions, onEdit, onDelete }) {
  return (
    <div className="relative overflow-x-auto">
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
              <td className="table-cell tabular whitespace-nowrap text-ink-soft">{formatDate(t.date)}</td>
              <td className="table-cell">
                <p className="font-medium">{t.description}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                  {t.productName && (
                    <span className="tabular">
                      {t.quantity} יח׳ × {formatMoney(t.unitPrice)}
                    </span>
                  )}
                  {t.source !== 'manual' && <Badge className="!px-2 !py-0.5">{SOURCE_LABELS[t.source]}</Badge>}
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
  );
}
