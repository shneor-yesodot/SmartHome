import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, FileText, Image, Receipt, ScanLine } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import ReceiptViewer from '../components/receipts/ReceiptViewer';
import { useFetch } from '../hooks/useFetch';
import { useAction } from '../hooks/useAction';
import { receiptService } from '../services/receipt.service';
import { formatDate, formatMoney } from '../utils/format';

const PAGE_SIZE = 20;

export default function MyReceipts() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => receiptService.list({ page, limit: PAGE_SIZE }), [page]);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { run, pending } = useAction();

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const receipts = data.data;
  const { pagination } = data.meta;

  const confirmDelete = async () => {
    const { ok } = await run(() => receiptService.remove(deleting.id), 'הקבלה נמחקה');
    if (!ok) return;
    setDeleting(null);
    setViewing(null);
    // The last receipt of a page was removed - go back one page
    if (receipts.length === 1 && page > 1) setPage(page - 1);
    else reload();
  };

  const upload = (
    <Link to="/receipts" className="btn btn-primary">
      <ScanLine className="h-4 w-4" />
      העלאת קבלה
    </Link>
  );

  return (
    <>
      <PageHeader title="הקבלות שלי" subtitle="כל הקבלות שהעליתם, עם הקובץ המקורי והמוצרים שנשמרו מהן">
        {upload}
      </PageHeader>

      <div className="card overflow-hidden">
        {receipts.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="עדיין לא הועלו קבלות"
            text="מצלמים קבלה או חשבונית, וכל מוצר בה נרשם כעסקה נפרדת. הקבלות יופיעו כאן."
            action={upload}
          />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {receipts.map((r) => {
                const Icon = r.mimeType === 'application/pdf' ? FileText : Image;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setViewing(r)}
                      className="flex w-full items-center gap-4 px-4 py-3.5 text-start transition-colors hover:bg-surface/70 sm:px-5"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{r.merchant || r.originalName || 'קבלה'}</p>
                        <p className="tabular text-xs text-ink-muted">
                          {formatDate(r.purchaseDate)} · {r.items.length} מוצרים
                        </p>
                      </div>
                      <div className="shrink-0 text-end">
                        <p className="tabular font-bold">{formatMoney(r.total)}</p>
                        {r.status === 'confirmed' ? <Badge tone="success">נשמרה</Badge> : <Badge tone="warning">ממתינה</Badge>}
                      </div>
                      <ChevronLeft className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pagination {...pagination} unit="קבלות" onChange={setPage} />
          </>
        )}
      </div>

      <ReceiptViewer receipt={viewing} onClose={() => setViewing(null)} onDelete={setDeleting} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="מחיקת קבלה"
        message={
          deleting?.status === 'confirmed'
            ? `למחוק את הקבלה ואת הקובץ המקורי? ${deleting.transactionsCount} העסקאות שנשמרו ממנה יישארו ברשימת העסקאות.`
            : 'למחוק את הקבלה ואת הקובץ המקורי?'
        }
        loading={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
