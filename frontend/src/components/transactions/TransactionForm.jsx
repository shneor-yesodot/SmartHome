import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Loader2, ScanLine, X } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import TypeToggle from '../ui/TypeToggle';
import { Field, Input, Select } from '../ui/Field';
import BasketItems, { basketTotal, newItem } from './BasketItems';
import { useCategories } from '../../context/CategoriesContext';
import { useToast } from '../../context/ToastContext';
import { useAction } from '../../hooks/useAction';
import { transactionService } from '../../services/transaction.service';
import { receiptService } from '../../services/receipt.service';
import { toInputDate, todayInput } from '../../utils/format';

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_RECEIPT_MB = 8;

const toForm = (t) => ({
  type: t?.type || 'expense',
  amount: t?.amount ?? '',
  category: t?.category?.id || '',
  description: t?.description || '',
  merchant: t?.merchant || '',
  date: t ? toInputDate(t.date) : todayInput(),
  productName: t?.productName || '',
  quantity: t?.quantity ?? 1,
  notes: t?.notes || '',
});

/** Create / edit a transaction. `transaction` is null when creating. */
export default function TransactionForm({ open, transaction, onClose, onSaved }) {
  const [wide, setWide] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={transaction ? 'עריכת עסקה' : 'עסקה חדשה'} size={wide ? 'lg' : 'md'}>
      {/* The key resets the form state whenever a different transaction is opened */}
      {open && (
        <FormBody key={transaction?.id || 'new'} transaction={transaction} onClose={onClose} onSaved={onSaved} onWide={setWide} />
      )}
    </Modal>
  );
}

function FormBody({ transaction, onClose, onSaved, onWide }) {
  const { byType } = useCategories();
  const toast = useToast();
  const { run, pending } = useAction();
  const [form, setForm] = useState(() => toForm(transaction));
  const [showProduct, setShowProduct] = useState(Boolean(transaction?.productName));

  // Several products in one purchase (new expenses only)
  const [multi, setMulti] = useState(false);
  const [items, setItems] = useState([]);
  const [receipt, setReceipt] = useState(null); // scanned in this dialog, not saved yet
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef(null);
  const savedRef = useRef(false);
  const receiptRef = useRef(null);
  receiptRef.current = receipt;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const categories = byType(form.type);
  const defaultCategory = (categories.find((c) => c.name === 'סופר ומזון') || categories[0])?.id || '';
  const canSplit = !transaction && form.type === 'expense';
  const basket = canSplit && multi;

  useEffect(() => {
    onWide(basket);
    return () => onWide(false);
  }, [basket, onWide]);

  // A receipt scanned here but never saved is removed when the dialog closes
  useEffect(
    () => () => {
      if (receiptRef.current && !savedRef.current) receiptService.remove(receiptRef.current.id).catch(() => {});
    },
    []
  );

  const startBasket = () => {
    setMulti(true);
    if (!items.length) {
      setItems([
        newItem({
          name: form.productName || form.description,
          total: form.amount,
          quantity: form.quantity || 1,
          category: form.category || defaultCategory,
        }),
      ]);
    }
  };

  const pickReceipt = (file) => {
    if (!file) return;
    if (!RECEIPT_TYPES.includes(file.type)) return toast.error('ניתן להעלות תמונה (JPG, PNG, WEBP) או קובץ PDF בלבד');
    if (file.size > MAX_RECEIPT_MB * 1024 * 1024) return toast.error(`הקובץ גדול מדי (עד ${MAX_RECEIPT_MB}MB)`);
    scanReceipt(file);
  };

  const scanReceipt = async (file) => {
    setScanning(true);
    const { ok, result } = await run(() => receiptService.scan(file));
    setScanning(false);
    if (!ok) return;
    if (receipt) receiptService.remove(receipt.id).catch(() => {});
    setReceipt(result);
    setMulti(true);
    setForm((f) => ({ ...f, type: 'expense', merchant: result.merchant || f.merchant, date: toInputDate(result.purchaseDate) || f.date }));
    setItems(result.items.map((i) => newItem({ name: i.name, quantity: i.quantity, total: i.total, category: i.category || defaultCategory })));
  };

  const dropReceipt = () => {
    receiptService.remove(receipt.id).catch(() => {});
    setReceipt(null);
  };

  const submitBasket = async () => {
    const payload = {
      merchant: form.merchant,
      date: form.date,
      items: items.map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity) || 1, total: Number(i.total), category: i.category || null })),
    };
    const { ok } = await run(
      () => (receipt ? receiptService.confirm(receipt.id, payload) : transactionService.createBasket({ ...payload, notes: form.notes })),
      `נשמרו ${items.length} מוצרים כעסקאות`
    );
    if (ok) {
      savedRef.current = true;
      onSaved();
      onClose();
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (basket) return submitBasket();
    const payload = {
      type: form.type,
      amount: Number(form.amount),
      category: form.category,
      description: form.description,
      merchant: form.merchant,
      date: form.date,
      notes: form.notes,
      productName: showProduct ? form.productName : '',
      ...(showProduct && form.productName ? { quantity: Number(form.quantity) || 1 } : {}),
    };
    const { ok } = await run(
      () => (transaction ? transactionService.update(transaction.id, payload) : transactionService.create(payload)),
      transaction ? 'העסקה עודכנה' : 'העסקה נוספה'
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  const merchantField = (
    <Field label="בית עסק">
      <Input maxLength={80} value={form.merchant} onChange={set('merchant')} placeholder="לא חובה" />
    </Field>
  );
  const dateField = (
    <Field label="תאריך">
      <Input type="date" required value={form.date} onChange={set('date')} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      {!receipt && <TypeToggle value={form.type} onChange={(type) => setForm((f) => ({ ...f, type, category: '' }))} />}

      {canSplit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl bg-surface p-1" role="radiogroup" aria-label="אופן הרישום">
            {[
              { value: false, label: 'סכום אחד' },
              { value: true, label: 'כמה מוצרים' },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={multi === o.value}
                disabled={Boolean(receipt)}
                onClick={() => (o.value ? startBasket() : setMulti(false))}
                className={clsx(
                  'rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors',
                  multi === o.value ? 'bg-white text-ink shadow-card' : 'text-ink-soft hover:text-ink'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={RECEIPT_TYPES.join(',')}
            hidden
            onChange={(e) => {
              pickReceipt(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" size="sm" icon={ScanLine} loading={scanning} disabled={scanning} onClick={() => fileRef.current.click()}>
            {receipt ? 'קבלה אחרת' : 'העלאת קבלה'}
          </Button>
        </div>
      )}

      {scanning && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          קוראים את הקבלה: בית העסק, התאריך וכל אחד מהמוצרים. זה לוקח כמה שניות.
        </p>
      )}

      {receipt && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm">
          <p className="min-w-0 text-brand-700">
            <b>זוהו {receipt.items.length} מוצרים</b> מהקבלה {receipt.originalName && <span className="truncate">({receipt.originalName})</span>}. בדקו ותקנו לפני השמירה.
            {receipt.engine === 'demo' && <span className="block text-xs text-warn-600">מצב הדגמה: אין מפתח Gemini בשרת, ולכן מוצגים מוצרים לדוגמה.</span>}
          </p>
          <button type="button" className="icon-btn shrink-0" onClick={dropReceipt} aria-label="ביטול הקבלה">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {basket ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {merchantField}
            {dateField}
          </div>
          <BasketItems items={items} onChange={setItems} categories={categories} defaultCategory={defaultCategory} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="סכום (₪)">
              <Input type="number" inputMode="decimal" min="0.01" step="0.01" required autoFocus value={form.amount} onChange={set('amount')} placeholder="0.00" />
            </Field>
            {dateField}
          </div>

          <Field label="תיאור">
            <Input required maxLength={140} value={form.description} onChange={set('description')} placeholder="למשל: קנייה שבועית" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="קטגוריה">
              <Select required value={form.category} onChange={set('category')}>
                <option value="" disabled>
                  בחירת קטגוריה
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            {merchantField}
          </div>

          {form.type === 'expense' && (
            <div className="rounded-xl border border-line p-3.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={showProduct} onChange={(e) => setShowProduct(e.target.checked)} />
                פירוט מוצר (למעקב מחירים)
              </label>
              {showProduct && (
                <div className="mt-3 grid grid-cols-[1fr_96px] gap-3">
                  <Field label="שם המוצר">
                    <Input maxLength={120} required value={form.productName} onChange={set('productName')} placeholder="למשל: חלב 3% 1 ליטר" />
                  </Field>
                  <Field label="כמות">
                    <Input type="number" min="0.001" step="any" value={form.quantity} onChange={set('quantity')} />
                  </Field>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!receipt && (
        <Field label="הערות">
          <Input maxLength={500} value={form.notes} onChange={set('notes')} placeholder="לא חובה" />
        </Field>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
        <Button type="submit" loading={pending && !scanning} disabled={scanning || (basket && !(basketTotal(items) > 0))}>
          {transaction ? 'שמירת שינויים' : basket ? `שמירת ${items.length} מוצרים` : 'הוספת עסקה'}
        </Button>
      </div>
    </form>
  );
}
