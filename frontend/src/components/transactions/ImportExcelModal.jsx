import { useRef, useState } from 'react';
import { AlertCircle, Download, FileSpreadsheet, Upload } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useAction } from '../../hooks/useAction';
import { transactionService } from '../../services/transaction.service';
import { downloadBlob } from '../../utils/download';
import { TYPE_LABELS } from '../../constants/options';
import { formatDate, formatMoney } from '../../utils/format';

/** Two steps: choose a file -> review the parsed rows -> create them all at once. */
export default function ImportExcelModal({ open, onClose, onImported }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const { run, pending } = useAction();

  const close = () => {
    setPreview(null);
    onClose();
  };

  const chooseFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { ok, result } = await run(() => transactionService.previewImport(file));
    if (ok) setPreview(result);
  };

  const downloadTemplate = async () => {
    const { ok, result } = await run(transactionService.downloadTemplate);
    if (ok) downloadBlob(result, 'smarthome-import-template.xlsx');
  };

  const confirm = async () => {
    const rows = preview.rows
      .filter((r) => !r.error)
      .map(({ type, amount, category, description, merchant, date, productName, quantity }) => ({
        type, amount, category, description, merchant, date, productName, quantity,
      }));
    const { ok, result } = await run(() => transactionService.bulkCreate(rows));
    if (ok) {
      onImported(result.created);
      close();
    }
  };

  const validCount = preview?.summary.valid || 0;

  return (
    <Modal
      open={open}
      onClose={close}
      title="יבוא עסקאות מ-Excel"
      size={preview ? 'xl' : 'md'}
      footer={
        preview && (
          <>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              בחירת קובץ אחר
            </Button>
            <Button loading={pending} disabled={!validCount} onClick={confirm}>
              יבוא {validCount} עסקאות
            </Button>
          </>
        )
      }
    >
      <input ref={inputRef} type="file" accept=".xlsx,.csv" hidden onChange={chooseFile} />

      {!preview ? (
        <div className="space-y-4">
          <button
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-6 py-10 text-center transition-colors hover:border-brand-400"
            onClick={() => inputRef.current.click()}
            disabled={pending}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-500 shadow-card">
              {pending ? <Upload className="h-7 w-7 animate-pulse" /> : <FileSpreadsheet className="h-7 w-7" />}
            </span>
            <span className="font-semibold">{pending ? 'קוראים את הקובץ' : 'בחירת קובץ Excel או CSV'}</span>
            <span className="text-sm text-ink-muted">עמודות נתמכות: תאריך, סוג, סכום, קטגוריה, תיאור, בית עסק, מוצר, כמות</span>
          </button>
          <button className="btn btn-ghost w-full" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            הורדת קובץ תבנית
          </button>
        </div>
      ) : (
        <>
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
        </>
      )}
    </Modal>
  );
}
