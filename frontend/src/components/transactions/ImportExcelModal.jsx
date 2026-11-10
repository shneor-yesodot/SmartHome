import { AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useAction } from '../../hooks/useAction';
import { transactionService } from '../../services/transaction.service';
import { TYPE_LABELS } from '../../constants/options';
import { formatDate, formatMoney } from '../../utils/format';

/** Rows read from a file in SmartHome's Excel template: review them, then create them all at once. */
export default function ImportExcelModal({ open, preview, onBack, onClose, onImported }) {
  const { run, pending } = useAction();

  const confirm = async () => {
    const rows = preview.rows
      .filter((r) => !r.error)
      .map(({ type, amount, category, description, merchant, date, productName, quantity }) => ({
        type, amount, category, description, merchant, date, productName, quantity,
      }));
    const { ok, result } = await run(() => transactionService.bulkCreate(rows));
    if (ok) {
      onImported(result.created);
      onClose();
    }
  };

  if (!preview) return null;
  const validCount = preview.summary.valid || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ייבוא מקובץ Excel"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onBack}>
            קובץ אחר
          </Button>
          <Button loading={pending} disabled={!validCount} onClick={confirm}>
            ייבוא {validCount} עסקאות
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="success">{preview.summary.valid} שורות תקינות</Badge>
        {preview.summary.invalid > 0 && <Badge tone="danger">{preview.summary.invalid} שורות שגויות (לא ייובאו)</Badge>}
        {preview.summary.unmatchedCategories > 0 && (
          <Badge tone="warning">{preview.summary.unmatchedCategories} ללא קטגוריה מתאימה (ישויכו ל״אחר״)</Badge>
        )}
      </div>
      <div className="max-h-[50vh] overflow-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr>
              <th className="table-head">שורה</th>
              <th className="table-head">תאריך</th>
              <th className="table-head">סוג</th>
              <th className="table-head">תיאור</th>
              <th className="table-head">קטגוריה</th>
              <th className="table-head">סכום</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {preview.rows.map((r) => (
              <tr key={r.row} className={r.error ? 'bg-danger-50/60' : ''}>
                <td className="table-cell tabular text-ink-muted">{r.row}</td>
                <td className="table-cell tabular">{r.date ? formatDate(r.date) : '-'}</td>
                <td className="table-cell">{TYPE_LABELS[r.type]}</td>
                <td className="table-cell">
                  {r.description || '-'}
                  {r.error && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-danger-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {r.error}
                    </span>
                  )}
                </td>
                <td className="table-cell">{r.categoryMatched ? r.categoryName : <span className="text-warn-600">{r.categoryName || 'לא צוינה'} ← אחר</span>}</td>
                <td className="table-cell tabular font-medium">{formatMoney(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
