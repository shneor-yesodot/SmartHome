import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Field, Select } from '../ui/Field';
import { useAction } from '../../hooks/useAction';
import { useFetch } from '../../hooks/useFetch';
import { useCategories } from '../../context/CategoriesContext';
import { accountService } from '../../services/account.service';
import { importService } from '../../services/import.service';
import { transactionService } from '../../services/transaction.service';
import { useToast } from '../../context/ToastContext';
import { downloadBlob } from '../../utils/download';
import { formatDate, formatMoney } from '../../utils/format';

const FLAGS = {
  imported: 'כבר יובאה בעבר',
  settlement: 'חיוב או זיכוי של כרטיס אשראי בעו״ש: העסקאות נספרות מדף הכרטיס, אז כדאי לא לספור פעמיים',
  cash: 'משיכת מזומן: נספרת כשרושמים את ההוצאות עצמן, אז כדאי לא לספור פעמיים',
  duplicate: 'נראה שכבר נרשמה',
};

const flagText = (row) => {
  if (row.flag === 'items') return `מתאים ל-${row.itemCount} הפריטים שרשמתם: הם יקושרו לחיוב ולא ייספרו פעמיים`;
  return row.flag === 'duplicate' && row.duplicateOf ? `${FLAGS.duplicate}: ${row.duplicateOf.description}, ${formatDate(row.duplicateOf.date)}` : FLAGS[row.flag];
};

const toPayload = ({ type, amount, category, account, description, date, chargeDate, notes, last4, isRefund, standing, importHash, purchase, adjust }) => ({
  type, amount, category, account, description, date, chargeDate, notes, last4, isRefund, standing, importHash, purchase, adjust,
});

const suggestionText = ({ itemCount, total, merchant, diff }) =>
  `קרוב ל-${itemCount} פריטים שרשמתם${merchant ? ` ב${merchant}` : ''} (${formatMoney(total)}, הפרש ${formatMoney(Math.abs(diff))}). אם זו אותה קנייה, ההפרש יירשם בפריטים וההוצאה תיספר פעם אחת`;

/** Choose a statement -> review each line (the risky ones start switched off) -> save. */
export default function ImportStatementModal({ open, onClose, onImported, onTemplate }) {
  const inputRef = useRef(null);
  const toast = useToast();
  const [reading, setReading] = useState(false);
  const { byType } = useCategories();
  const { data: accounts } = useFetch(accountService.list, []);
  const { run, pending } = useAction();
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [account, setAccount] = useState('');

  const close = () => {
    setPreview(null);
    setRows([]);
    setAccount('');
    onClose();
  };

  const chooseFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReading(true);
    try {
      const result = await importService.preview(file);
      setPreview(result);
      setRows(result.rows);
    } catch (err) {
      // A file in the app's own template is not a statement: it is read as one row per transaction
      if (err.details?.format === 'smarthome-template' && onTemplate) {
        try {
          onTemplate(await transactionService.previewImport(file));
        } catch (templateError) {
          toast.error(templateError.message);
        }
      } else toast.error(err.message);
    } finally {
      setReading(false);
    }
  };

  const downloadTemplate = async () => {
    const { ok, result } = await run(transactionService.downloadTemplate);
    if (ok) downloadBlob(result, 'smarthome-import-template.xlsx');
  };

  const patch = (rowNumber, change) => setRows((list) => list.map((r) => (r.row === rowNumber ? { ...r, ...change } : r)));

  const selected = useMemo(() => rows.filter((r) => r.include && r.flag !== 'imported'), [rows]);
  const totals = useMemo(() => {
    const expense = selected.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    const income = selected.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    return { expense, income };
  }, [selected]);
  const needsAccount = rows.some((r) => !r.last4 && r.include);

  const confirm = async () => {
    const { ok, result } = await run(() => importService.commit(selected.map(toPayload), account));
    if (ok) {
      onImported(result);
      close();
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="ייבוא קובץ"
      size={preview ? 'xl' : 'md'}
      footer={
        preview && (
          <>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              קובץ אחר
            </Button>
            <Button loading={pending} disabled={!selected.length} onClick={confirm}>
              ייבוא {selected.length} תנועות
            </Button>
          </>
        )
      }
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.html,.htm" hidden onChange={chooseFile} />

      {!preview ? (
        <div className="space-y-3">
          <button
            type="button"
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-6 py-10 text-center transition-colors hover:border-brand-400"
            onClick={() => inputRef.current.click()}
            disabled={reading}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-500 shadow-card">
              {reading ? <Upload className="h-7 w-7 animate-pulse" /> : <FileSpreadsheet className="h-7 w-7" />}
            </span>
            <span className="font-semibold">{reading ? 'קוראים את הקובץ' : 'בחירת קובץ'}</span>
            <span className="text-sm text-ink-muted">
              דף עו״ש או פירוט אשראי שהורדתם מאתר הבנק או חברת האשראי, או קובץ Excel בתבנית של SmartHome. לפני השמירה תוכלו לבדוק כל שורה.
            </span>
          </button>
          <button type="button" className="btn btn-ghost w-full" onClick={downloadTemplate} disabled={pending}>
            <Download className="h-4 w-4" />
            הורדת תבנית Excel לרישום ידני
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">{selected.length} ייובאו</Badge>
            {preview.summary.imported > 0 && <Badge>{preview.summary.imported} כבר יובאו בעבר</Badge>}
            {preview.summary.settlements > 0 && <Badge tone="warning">{preview.summary.settlements} חיובי כרטיס בעו״ש</Badge>}
            {preview.summary.linkedPurchases > 0 && <Badge tone="success">{preview.summary.linkedPurchases} יקושרו לפריטים שנרשמו</Badge>}
            {preview.summary.suggestedPurchases > 0 && <Badge tone="warning">{preview.summary.suggestedPurchases} קרובות לפריטים שנרשמו, לבדיקה</Badge>}
            {preview.summary.cashWithdrawals > 0 &&<Badge tone="warning">{preview.summary.cashWithdrawals} משיכות מזומן</Badge>}
            {preview.summary.duplicates > 0 &&<Badge tone="warning">{preview.summary.duplicates} ייתכן שכבר נרשמו</Badge>}
          </div>

          <p className="tabular text-sm text-ink-soft">
            סה״כ הוצאות: <b className="text-ink">{formatMoney(totals.expense)}</b> · הכנסות וזיכויים: <b className="text-ink">{formatMoney(totals.income)}</b>
          </p>

          {preview.newCards.length > 0 && (
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
              זוהו כרטיסים חדשים ({preview.newCards.map((c) => `****${c}`).join(', ')}). הם ייפתחו אוטומטית, ואפשר לתת להם שם במסך כרטיסי האשראי.
            </p>
          )}

          {needsAccount && (
            <Field label="לאיזה חשבון או כרטיס שייך הדף?">
              <Select value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="">בלי שיוך</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <ul className="max-h-[48vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {rows.map((r) => {
              const locked = r.flag === 'imported';
              return (
                <li key={r.row} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 p-3 sm:grid-cols-[auto_minmax(0,1fr)_170px_auto] sm:items-center ${r.include && !locked ? '' : 'bg-surface/70'}`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 accent-brand-500 sm:mt-0"
                    checked={r.include && !locked}
                    disabled={locked}
                    onChange={(e) => patch(r.row, { include: e.target.checked })}
                    aria-label={`ייבוא ${r.description}`}
                  />
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-medium ${r.include && !locked ? '' : 'text-ink-muted'}`}>{r.description}</p>
                    <p className="tabular text-xs text-ink-muted">
                      {formatDate(r.date)}
                      {r.last4 && ` · ****${r.last4}`}
                      {r.chargeDate && ` · חיוב ${formatDate(r.chargeDate)}`}
                      {r.notes && ` · ${r.notes}`}
                      {r.isRefund && ' · זיכוי'}
                      {r.standing && ' · הוראת קבע'}
                    </p>
                    {r.flag && <p className="mt-0.5 text-xs text-warn-600">{flagText(r)}</p>}
                    {r.suggestion && (
                      <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs text-brand-700">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
                          checked={Boolean(r.purchase)}
                          onChange={(e) => patch(r.row, e.target.checked ? { purchase: r.suggestion.purchase, adjust: true, include: true } : { purchase: null, adjust: false })}
                        />
                        <span>{suggestionText(r.suggestion)}</span>
                      </label>
                    )}
                  </div>
                  <span className={`tabular whitespace-nowrap text-sm font-semibold sm:order-last ${r.type === 'income' ? 'text-brand-600' : ''}`}>
                    {r.type === 'income' ? '+' : ''}
                    {formatMoney(r.amount)}
                  </span>
                  <Select
                    className="col-start-2 col-end-4 !py-1.5 sm:col-auto"
                    value={r.category || ''}
                    disabled={locked || Boolean(r.purchase)}
                    onChange={(e) => patch(r.row, { category: e.target.value || null })}
                    aria-label={`קטגוריה של ${r.description}`}
                  >
                    <option value="">אחר</option>
                    {byType(r.type).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
