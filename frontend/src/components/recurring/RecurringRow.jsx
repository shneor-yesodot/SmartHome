import { Pencil, Play, Trash2 } from 'lucide-react';
import CategoryIcon from '../ui/CategoryIcon';
import Switch from '../ui/Switch';
import { FREQUENCY_LABELS } from '../../constants/options';
import { formatDate, formatTransactionAmount } from '../../utils/format';

export default function RecurringRow({ payment, busy, onToggle, onRun, onEdit, onDelete }) {
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 ${payment.isActive ? '' : 'opacity-60'}`}>
      <CategoryIcon icon={payment.category?.icon} color={payment.category?.color} size={42} />
      <div className="min-w-[160px] flex-1">
        <p className="font-semibold">{payment.description}</p>
        <p className="text-sm text-ink-muted">
          {FREQUENCY_LABELS[payment.frequency]}, {payment.category?.name}
          {payment.merchant ? `, ${payment.merchant}` : ''}
        </p>
      </div>
      <div className="min-w-[110px]">
        <p className="text-xs text-ink-muted">החיוב הבא</p>
        <p className="tabular text-sm font-medium">{payment.isActive ? formatDate(payment.nextRun) : 'מושהה'}</p>
      </div>
      <p className={`tabular min-w-[100px] text-lg font-bold ${payment.type === 'income' ? 'text-brand-600' : ''}`}>
        {formatTransactionAmount(payment)}
      </p>
      <div className="flex items-center gap-1">
        <Switch checked={payment.isActive} disabled={busy} onChange={() => onToggle(payment)} label={`הפעלת ${payment.description}`} />
        <button className="icon-btn" disabled={busy || !payment.isActive} onClick={() => onRun(payment)} title="ביצוע עכשיו" aria-label={`ביצוע עכשיו של ${payment.description}`}>
          <Play className="h-4 w-4" />
        </button>
        <button className="icon-btn" onClick={() => onEdit(payment)} aria-label={`עריכת ${payment.description}`}>
          <Pencil className="h-4 w-4" />
        </button>
        <button className="icon-btn hover:!bg-danger-50 hover:!text-danger-500" onClick={() => onDelete(payment)} aria-label={`מחיקת ${payment.description}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
