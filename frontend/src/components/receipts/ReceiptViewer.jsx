import { useEffect, useState } from 'react';
import { Download, FileText, Loader2, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import CategoryIcon from '../ui/CategoryIcon';
import { receiptService } from '../../services/receipt.service';
import { formatDate, formatMoney } from '../../utils/format';

/** The original receipt file next to the product lines that were saved from it. */
export default function ReceiptViewer({ receipt, onClose, onDelete }) {
  return (
    <Modal open={Boolean(receipt)} onClose={onClose} title={receipt?.merchant || receipt?.originalName || 'קבלה'} size="xl">
      {receipt && <ViewerBody key={receipt.id} receipt={receipt} onDelete={onDelete} />}
    </Modal>
  );
}

function ViewerBody({ receipt, onDelete }) {
  const [file, setFile] = useState({ url: null, loading: true, error: false });
  const isPdf = receipt.mimeType === 'application/pdf';

  useEffect(() => {
    let url = null;
    let active = true;
    receiptService
      .file(receipt.id)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (active) setFile({ url, loading: false, error: false });
      })
      .catch(() => active && setFile({ url: null, loading: false, error: true }));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [receipt.id]);

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl border border-line bg-surface">
        {file.loading && <Loader2 className="h-6 w-6 animate-spin text-brand-500" aria-label="טוען את הקובץ" />}
        {file.error && <p className="px-4 text-center text-sm text-ink-muted">לא ניתן להציג את הקובץ המקורי.</p>}
        {file.url &&
          (isPdf ? (
            <iframe src={file.url} title="הקבלה המקורית" className="h-[60vh] w-full" />
          ) : (
            <img src={file.url} alt="הקבלה המקורית" className="max-h-[60vh] w-full object-contain" />
          ))}
      </div>

      <div className="min-w-0">
        <dl className="tabular grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink-muted">תאריך הקנייה</dt>
            <dd className="font-semibold">{formatDate(receipt.purchaseDate)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">סה״כ</dt>
            <dd className="font-semibold">{formatMoney(receipt.total)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">הועלתה</dt>
            <dd>{formatDate(receipt.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">מצב</dt>
            <dd>
              {receipt.status === 'confirmed' ? (
                <Badge tone="success">נשמרו {receipt.transactionsCount} עסקאות</Badge>
              ) : (
                <Badge tone="warning">ממתינה לבדיקה</Badge>
              )}
            </dd>
          </div>
        </dl>

        <h3 className="mb-2 mt-5 text-sm font-bold">{receipt.items.length} מוצרים</h3>
        <ul className="max-h-[38vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {receipt.items.map((item, i) => (
            <li key={`${item.name}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
              {item.category && <CategoryIcon icon={item.category.icon} color={item.category.color} size={30} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="tabular text-xs text-ink-muted">
                  {item.quantity} × {formatMoney(item.unitPrice)}
                  {item.category && ` · ${item.category.name}`}
                </p>
              </div>
              <span className="tabular shrink-0 text-sm font-semibold">{formatMoney(item.total)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <Button variant="secondary" size="sm" icon={Trash2} onClick={() => onDelete(receipt)} className="hover:!text-danger-500">
            מחיקת הקבלה
          </Button>
          {file.url && (
            <a href={file.url} download={receipt.originalName || `receipt${isPdf ? '.pdf' : ''}`} className="btn btn-secondary btn-sm">
              {isPdf ? <FileText className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              הורדת הקובץ
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
