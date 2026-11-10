import { useState } from 'react';
import { ListPlus, Plus } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import TypeToggle from '../ui/TypeToggle';
import { Field, Input, Select } from '../ui/Field';
import BasketItems, { basketTotal, newItem } from './BasketItems';
import SplitForm from './SplitForm';
import PaymentMatch from './PaymentMatch';
import PurchaseItems from './PurchaseItems';
import { useCategories } from '../../context/CategoriesContext';
import { useAction } from '../../hooks/useAction';
import { useFetch } from '../../hooks/useFetch';
import { accountService } from '../../services/account.service';
import { transactionService } from '../../services/transaction.service';
import { formatMoney, toInputDate, todayInput } from '../../utils/format';

const TITLES = { expense: 'הוצאה חדשה', income: 'הכנסה חדשה' };

const toForm = (t, mode) => ({
  type: t?.type || (mode === 'income' ? 'income' : 'expense'),
  amount: t?.amount ?? '',
  category: t?.category?.id || '',
  account: t?.account?.id || '',
  description: t?.description || '',
  merchant: t?.merchant || '',
  date: t ? toInputDate(t.date) : todayInput(),
  productName: t?.productName || '',
  quantity: t?.quantity ?? 1,
  notes: t?.notes || '',
});

/**
 * Create / edit a transaction. `transaction` is null when creating, and `mode` says what
 * is being added: an expense or an income. Receipts have their own screen.
 */
export default function TransactionForm({ open, transaction, mode = 'expense', onClose, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title={transaction ? 'עריכת עסקה' : TITLES[mode]}>
      {/* The key resets the form state whenever a different transaction is opened */}
      {open && <FormBody key={transaction?.id || `new-${mode}`} transaction={transaction} mode={mode} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function FormBody({ transaction, mode, onClose, onSaved }) {
  const [splitting, setSplitting] = useState(false);
  if (splitting) {
    return (
      <SplitForm
        transaction={transaction}
        onBack={() => setSplitting(false)}
        onDone={() => {
          onSaved();
          onClose();
        }}
      />
    );
  }
  return <EditBody transaction={transaction} mode={mode} onClose={onClose} onSaved={onSaved} onSplit={() => setSplitting(true)} />;
}

function EditBody({ transaction, mode, onClose, onSaved, onSplit }) {
  const { byType } = useCategories();
  const { data: accounts } = useFetch(accountService.list, []);
  const { run, pending } = useAction();
  const [form, setForm] = useState(() => toForm(transaction, mode));
  const [showProduct, setShowProduct] = useState(Boolean(transaction?.productName));

  // A new expense can hold several products; each one is saved as its own transaction
  const [items, setItems] = useState([]);
  const [payment, setPayment] = useState(null); // an imported statement line these items replace
  const [purchaseSize, setPurchaseSize] = useState(0); // items bought together with the one being edited

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const categories = byType(form.type);
  const defaultCategory = form.category || (categories.find((c) => c.name === 'אוכל' || c.name === 'סופר ומזון') || categories[0])?.id || '';
  const canAddProducts = !transaction && form.type === 'expense';
  const basket = items.length > 0;

  /** The first click turns what was typed so far into product 1 and adds product 2. */
  const addProduct = () => {
    if (basket) return setItems((list) => [...list, newItem({ category: defaultCategory })]);
    setItems([
      newItem({
        name: (showProduct && form.productName) || form.description,
        quantity: (showProduct && form.quantity) || 1,
        total: form.amount,
        category: defaultCategory,
      }),
      newItem({ category: defaultCategory }),
    ]);
  };

  /** Back to a single product (typed by hand) - its details return to the regular fields. */
  const changeItems = (next) => {
    if (next.length === 0) return setItems([]);
    if (next.length === 1) {
      const [only] = next;
      setForm((f) => ({ ...f, amount: only.total, description: only.name || f.description, category: only.category || f.category }));
      setItems([]);
      return;
    }
    setItems(next);
  };

  const submitBasket = async () => {
    const payload = {
      merchant: form.merchant,
      date: form.date,
      payment,
      items: items.map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity) || 1, total: Number(i.total), category: i.category || null })),
    };
    const { ok } = await run(
      () => transactionService.createBasket({ ...payload, notes: form.notes, account: form.account || null }),
      payment ? `נשמרו ${items.length} מוצרים במקום שורת החיוב` : `נשמרו ${items.length} מוצרים כעסקאות`
    );
    if (ok) {
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
      account: form.account || null,
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
  const accountField = (
    <Field label="כרטיס או חשבון">
      <Select value={form.account} onChange={set('account')}>
        <option value="">לא צוין</option>
        {accounts?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      {transaction?.purchase && <PurchaseItems transaction={transaction} onLoad={setPurchaseSize} />}
      {/* The type is chosen by the button that opened the dialog; editing can still correct it */}
      {transaction && <TypeToggle value={form.type} onChange={(type) => setForm((f) => ({ ...f, type, category: '' }))} />}

      {basket ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {merchantField}
            {dateField}
          </div>
          {!payment && accountField}
          <BasketItems items={items} onChange={changeItems} categories={categories} />
          <PaymentMatch date={form.date} total={basketTotal(items)} merchant={form.merchant} value={payment} onChange={setPayment} />
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

          {accountField}

          {transaction && form.type === 'expense' && (
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

      {canAddProducts && (
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" size="sm" icon={basket ? Plus : ListPlus} onClick={addProduct}>
            {basket ? 'מוצר נוסף' : 'פירוט לפי מוצרים'}
          </Button>
          {basket && (
            <p className="text-sm text-ink-soft">
              {items.length} מוצרים · סה״כ <b className="tabular text-base text-ink">{formatMoney(basketTotal(items))}</b>
            </p>
          )}
        </div>
      )}

      <Field label="הערות">
        <Input maxLength={500} value={form.notes} onChange={set('notes')} placeholder="לא חובה" />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        {transaction?.type === 'expense' && (!transaction.purchase || purchaseSize === 1) && (
          <Button variant="secondary" className="me-auto" onClick={onSplit}>
            פיצול לפריטים
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
        <Button type="submit" loading={pending}>
          {transaction ? 'שמירת שינויים' : basket ? `שמירת ${items.length} מוצרים` : form.type === 'income' ? 'הוספת הכנסה' : 'הוספת הוצאה'}
        </Button>
      </div>
    </form>
  );
}
