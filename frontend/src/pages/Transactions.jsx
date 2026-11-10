import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileUp, Receipt } from 'lucide-react';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import TransactionFilters, { EMPTY_FILTERS } from '../components/transactions/TransactionFilters';
import TransactionTable from '../components/transactions/TransactionTable';
import TransactionForm from '../components/transactions/TransactionForm';
import ImportFileModal from '../components/transactions/ImportFileModal';
import AddButtons from '../components/transactions/AddButtons';
import { useFetch } from '../hooks/useFetch';
import { useDebounce } from '../hooks/useDebounce';
import { useAction } from '../hooks/useAction';
import { transactionService } from '../services/transaction.service';
import { downloadBlob } from '../utils/download';
import { formatMoney, todayInput } from '../utils/format';

const PAGE_SIZE = 15;

export default function Transactions() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new
  const [mode, setMode] = useState('expense'); // what a new one is: expense or income
  const [deleting, setDeleting] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { run, pending } = useAction();

  const search = useDebounce(filters.search);
  const query = { ...filters, search };
  const queryKey = JSON.stringify(query);

  // Any change of filters returns to the first page
  useEffect(() => setPage(1), [queryKey]);

  const add = (kind) => {
    setMode(kind);
    setEditing(null);
  };

  // The + button on phones and the app-icon shortcut open a new expense right away (?new=income for an income)
  useEffect(() => {
    const kind = searchParams.get('new');
    if (kind) {
      setMode(kind === 'income' ? 'income' : 'expense');
      setEditing(null);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data, loading, error, reload } = useFetch(
    () => transactionService.list({ ...query, page, limit: PAGE_SIZE }),
    [queryKey, page]
  );

  const exportExcel = async () => {
    const { ok, result } = await run(() => transactionService.exportExcel(query));
    if (ok) downloadBlob(result, `smarthome-transactions-${todayInput()}.xlsx`);
  };

  const confirmDelete = async () => {
    const { ok } = await run(() => transactionService.remove(deleting.id), 'העסקה נמחקה');
    if (ok) {
      setDeleting(null);
      reload();
    }
  };

  const items = data?.data || [];
  const totals = data?.meta.totals;
  const isFiltered = Object.values(query).some(Boolean);

  return (
    <>
      <PageHeader title="עסקאות" subtitle="כל ההכנסות וההוצאות של משק הבית">
        <Button variant="ghost" icon={Download} className="hidden sm:inline-flex" onClick={exportExcel} disabled={pending || !items.length}>
          ייצוא
        </Button>
        <Button variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>
          ייבוא קובץ
        </Button>
        <AddButtons onAdd={add} />
      </PageHeader>

      <TransactionFilters filters={filters} onChange={setFilters} />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <PageLoader />
      ) : (
        <div className="card overflow-hidden">
          {totals && items.length > 0 && (
            <dl className="tabular flex flex-wrap gap-x-8 gap-y-1 border-b border-line px-4 py-3 text-sm">
              <div className="flex gap-2">
                <dt className="text-ink-muted">הכנסות</dt>
                <dd className="font-semibold text-brand-600">{formatMoney(totals.income)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-muted">הוצאות</dt>
                <dd className="font-semibold text-danger-500">{formatMoney(totals.expense)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-muted">מאזן</dt>
                <dd className="font-semibold">{formatMoney(totals.balance)}</dd>
              </div>
            </dl>
          )}

          {items.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={isFiltered ? 'לא נמצאו עסקאות שמתאימות לסינון' : 'עדיין אין עסקאות'}
              text={isFiltered ? 'נסו לשנות את החיפוש או לנקות את הסינון.' : 'הוסיפו הוצאה או הכנסה, ייבאו דף מהבנק או העלו קבלה.'}
              action={
                !isFiltered && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <AddButtons onAdd={add} />
                  </div>
                )
              }
            />
          ) : (
            <>
              <TransactionTable transactions={items} onEdit={setEditing} onDelete={setDeleting} />
              <Pagination {...data.meta.pagination} onChange={setPage} />
            </>
          )}
        </div>
      )}

      <TransactionForm open={editing !== undefined} transaction={editing || null} mode={mode} onClose={() => setEditing(undefined)} onSaved={reload} />
      <ImportFileModal open={importOpen} onClose={() => setImportOpen(false)} onImported={reload} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="מחיקת עסקה"
        message={`למחוק את העסקה "${deleting?.description}"? לא ניתן לבטל את הפעולה.`}
        loading={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
