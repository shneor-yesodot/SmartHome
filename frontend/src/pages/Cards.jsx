import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Banknote, CalendarClock, CreditCard, FileUp, Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import PeriodNav from '../components/ui/PeriodNav';
import Segmented from '../components/ui/Segmented';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import AccountForm from '../components/accounts/AccountForm';
import ImportStatementModal from '../components/transactions/ImportStatementModal';
import TransactionForm from '../components/transactions/TransactionForm';
import TransactionTable from '../components/transactions/TransactionTable';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAction } from '../hooks/useAction';
import { useFetch } from '../hooks/useFetch';
import { accountService } from '../services/account.service';
import { transactionService } from '../services/transaction.service';
import { formatDate, formatMoney } from '../utils/format';
import { formatDay } from '../utils/hebrewDate';

const KIND_ICONS = { credit: CreditCard, bank: Landmark, cash: Banknote };
const VIEWS = [
  { value: 'period', label: 'לפי חודש' },
  { value: 'charge', label: 'לפי מועד חיוב' },
];
const DETAIL_LIMIT = 100;

const isoDay = (date) => new Date(date).toISOString().slice(0, 10);

function AccountCard({ account, calendar, selected, onSelect, onEdit, onDelete }) {
  const Icon = KIND_ICONS[account.kind] || CreditCard;
  const top = account.categories.slice(0, 3);
  return (
    <article className={clsx('card overflow-hidden transition-shadow', selected && 'ring-2 ring-brand-500')}>
      <div className="h-1.5" style={{ backgroundColor: account.color }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-start" onClick={() => onSelect(account)} aria-pressed={selected}>
            <Icon className="h-5 w-5 shrink-0" style={{ color: account.color }} />
            <span className="min-w-0">
              <span className="block truncate font-bold">{account.name}</span>
              <span dir="ltr" className="tabular block text-end text-xs text-ink-muted">
                {account.last4 ? `**** ${account.last4}` : account.issuer}
              </span>
            </span>
          </button>
          <div className="flex shrink-0">
            <button className="icon-btn" onClick={() => onEdit(account)} aria-label={`עריכת ${account.name}`}>
              <Pencil className="h-4 w-4" />
            </button>
            <button className="icon-btn hover:!bg-danger-50 hover:!text-danger-500" onClick={() => onDelete(account)} aria-label={`מחיקת ${account.name}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button type="button" className="mt-3 block w-full text-start" onClick={() => onSelect(account)}>
          <p className="tabular text-2xl font-extrabold">{formatMoney(account.spent)}</p>
          <p className="text-xs text-ink-muted">{account.count} תנועות בחודש הזה</p>

          {account.nextCharge && (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-ink-soft">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-brand-500" />
              <span>
                החיוב הבא ב-{formatDay(account.nextCharge.date, calendar)}: <b className="tabular text-ink">{formatMoney(account.nextCharge.total)}</b>
              </span>
            </p>
          )}

          {top.length > 0 && (
            <ul className="mt-3 space-y-1">
              {top.map((c) => (
                <li key={c.categoryId} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-ink-soft">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="tabular shrink-0">{formatMoney(c.total, { round: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </button>
      </div>
    </article>
  );
}

/** One account's movements, either in the month shown or per charge to the bank account. */
function AccountDetail({ account, period, calendar, version, onChanged }) {
  const [view, setView] = useState('period');
  const [chargeDate, setChargeDate] = useState(null);
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const { run, pending } = useAction();

  const isCard = account.kind === 'credit';
  const { data: charges } = useFetch(() => (isCard ? accountService.charges(account.id) : Promise.resolve([])), [account.id, isCard, version]);

  // The latest charge is what is shown first in that view
  useEffect(() => {
    setChargeDate((current) => (charges?.some((c) => isoDay(c.date) === current) ? current : charges?.[0] ? isoDay(charges[0].date) : null));
  }, [charges]);

  const showing = view === 'charge' && isCard;
  const query = showing
    ? { account: account.id, chargeDate, limit: DETAIL_LIMIT }
    : { account: account.id, from: isoDay(period.start), to: isoDay(period.end), limit: DETAIL_LIMIT };
  const { data, reload, loading } = useFetch(
    () => (showing && !chargeDate ? Promise.resolve({ data: [], meta: {} }) : transactionService.list(query)),
    [JSON.stringify(query), showing, version]
  );
  const items = data?.data || [];

  const saved = () => {
    reload();
    onChanged();
  };

  const confirmDelete = async () => {
    const { ok } = await run(() => transactionService.remove(deleting.id), 'העסקה נמחקה');
    if (ok) {
      setDeleting(null);
      saved();
    }
  };

  return (
    <Card
      title={`פירוט ${account.name}`}
      action={isCard ? <Segmented label="תצוגה" options={VIEWS} value={view} onChange={setView} /> : null}
    >
      {showing && (
        charges?.length ? (
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {charges.map((c) => {
              const key = isoDay(c.date);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={key === chargeDate}
                  onClick={() => setChargeDate(key)}
                  className={clsx('shrink-0 rounded-xl border px-3 py-2 text-start text-sm', key === chargeDate ? 'border-brand-500 bg-brand-50' : 'border-line bg-white')}
                >
                  <span className="tabular block text-xs text-ink-muted">{formatDate(c.date)}</span>
                  <span className="tabular block font-bold">{formatMoney(c.total)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mb-4 text-sm text-ink-muted">אין עדיין חיובים. הגדירו יום חיוב לכרטיס, או ייבאו דף פירוט.</p>
        )
      )}

      {loading && !data ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">{showing ? 'אין תנועות בחיוב הזה.' : `אין תנועות ב${period.label}.`}</p>
      ) : (
        <div className="-mx-5 -mb-5 border-t border-line">
          <TransactionTable transactions={items} onEdit={setEditing} onDelete={setDeleting} calendar={calendar} />
        </div>
      )}

      <TransactionForm open={editing !== undefined} transaction={editing || null} onClose={() => setEditing(undefined)} onSaved={saved} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="מחיקת עסקה"
        message={`למחוק את העסקה "${deleting?.description}"? לא ניתן לבטל את הפעולה.`}
        loading={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  );
}

export default function Cards() {
  const { user } = useAuth();
  const toast = useToast();
  const [calendar, setCalendar] = useState(user?.calendar || 'gregorian');
  const [anchor, setAnchor] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const { run, pending } = useAction();

  const { data, loading, error, reload } = useFetch(() => accountService.overview({ calendar, date: anchor || undefined }), [calendar, anchor, version]);
  const refresh = () => setVersion((v) => v + 1);

  const accounts = data?.accounts || [];
  const selected = accounts.find((a) => a.id === selectedId) || accounts[0];

  const confirmDelete = async () => {
    const { ok } = await run(() => accountService.remove(deleting.id), 'אמצעי התשלום נמחק. העסקאות שלו נשמרו');
    if (ok) {
      setDeleting(null);
      refresh();
    }
  };

  return (
    <>
      <PageHeader title="כרטיסי אשראי וחשבונות" subtitle="כמה יצא, מאיזה כרטיס, ומתי זה יורד מהעו״ש">
        <PeriodNav
          period={data?.period}
          calendar={calendar}
          onCalendarChange={(value) => {
            setAnchor(null);
            setCalendar(value);
          }}
          onAnchorChange={setAnchor}
        />
        <Button variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>
          יבוא דף
        </Button>
        <Button icon={Plus} onClick={() => setEditing(null)}>
          הוספה
        </Button>
      </PageHeader>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <PageLoader />
      ) : accounts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CreditCard}
            title="עדיין אין כרטיסים"
            text="הוסיפו כרטיס אשראי או חשבון בנק. אפשר גם לייבא דף פירוט אשראי, והכרטיסים ייפתחו מעצמם."
            action={
              <Button icon={Plus} onClick={() => setEditing(null)}>
                הוספה
              </Button>
            }
          />
        </div>
      ) : (
        <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
          <dl className="card tabular flex flex-wrap gap-x-8 gap-y-2 px-4 py-3 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-muted">סה״כ ב{data.period.label}</dt>
              <dd className="font-bold">{formatMoney(data.totalSpent)}</dd>
            </div>
            {data.unassigned.count > 0 && (
              <div className="flex gap-2">
                <dt className="text-ink-muted">הוצאות בלי אמצעי תשלום</dt>
                <dd className="font-semibold">
                  {formatMoney(data.unassigned.total)} ({data.unassigned.count})
                </dd>
              </div>
            )}
          </dl>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                calendar={calendar}
                selected={selected?.id === account.id}
                onSelect={(a) => setSelectedId(a.id)}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </div>

          {selected && <AccountDetail key={selected.id} account={selected} period={data.period} calendar={calendar} version={version} onChanged={refresh} />}
        </div>
      )}

      <AccountForm open={editing !== undefined} account={editing || null} onClose={() => setEditing(undefined)} onSaved={refresh} />
      <ImportStatementModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={({ created, skipped }) => {
          toast.success(skipped ? `יובאו ${created} תנועות, ${skipped} כבר היו במערכת` : `יובאו ${created} תנועות`);
          refresh();
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="מחיקת אמצעי תשלום"
        message={`למחוק את "${deleting?.name}"? העסקאות שלו יישארו, רק בלי שיוך לכרטיס.`}
        loading={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
