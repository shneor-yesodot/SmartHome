import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FileText } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import ReceiptDropzone from '../components/receipts/ReceiptDropzone';
import ReceiptReview from '../components/receipts/ReceiptReview';
import { useFetch } from '../hooks/useFetch';
import { useAction } from '../hooks/useAction';
import { useToast } from '../context/ToastContext';
import { receiptService } from '../services/receipt.service';
import { formatDate, formatMoney } from '../utils/format';

export default function UploadReceipt() {
  const toast = useToast();
  const { run, pending } = useAction();
  const history = useFetch(receiptService.list, []);
  const [receipt, setReceipt] = useState(null); // scanned, waiting for review
  const [previewUrl, setPreviewUrl] = useState(null);
  const [savedCount, setSavedCount] = useState(null);

  // Release the local image preview when it is replaced or the page closes
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const reset = () => {
    setReceipt(null);
    setPreviewUrl(null);
    setSavedCount(null);
  };

  const scan = async (file) => {
    setSavedCount(null);
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    const { ok, result } = await run(() => receiptService.scan(file));
    if (ok) setReceipt(result);
    else setPreviewUrl(null);
  };

  const confirm = async (payload) => {
    const { ok, result } = await run(() => receiptService.confirm(receipt.id, payload));
    if (ok) {
      setSavedCount(result.created);
      setReceipt(null);
      setPreviewUrl(null);
      history.reload();
    }
  };

  const cancel = async () => {
    await receiptService.remove(receipt.id).catch(() => {});
    reset();
  };

  return (
    <>
      <PageHeader title="העלאת קבלה" subtitle="מצלמים קבלה או חשבונית, וכל מוצר בה נרשם כעסקה נפרדת" />

      {receipt ? (
        <ReceiptReview receipt={receipt} previewUrl={previewUrl} saving={pending} onConfirm={confirm} onCancel={cancel} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            {savedCount !== null && (
              <div className="card flex flex-wrap items-center gap-4 border-brand-200 bg-brand-50 p-5">
                <CheckCircle2 className="h-8 w-8 shrink-0 text-brand-500" />
                <div className="flex-1">
                  <p className="font-bold">נשמרו {savedCount} עסקאות מהקבלה</p>
                  <p className="text-sm text-ink-soft">המוצרים נוספו גם לקטלוג המוצרים, למעקב מחירים.</p>
                </div>
                <div className="flex gap-2">
                  <Link to="/products" className="btn btn-secondary btn-sm">
                    לקטלוג המוצרים
                  </Link>
                  <Link to="/transactions" className="btn btn-secondary btn-sm">
                    לעסקאות
                  </Link>
                </div>
              </div>
            )}
            <ReceiptDropzone scanning={pending} onFile={scan} onInvalid={toast.error} />
          </div>

          <Card title="קבלות אחרונות" icon={FileText}>
            {!history.data?.length ? (
              <p className="py-6 text-center text-sm text-ink-muted">הקבלות שתעלו יופיעו כאן.</p>
            ) : (
              <ul className="divide-y divide-line">
                {history.data.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.merchant || r.originalName || 'קבלה'}</p>
                      <p className="tabular text-xs text-ink-muted">
                        {formatDate(r.purchaseDate)}, {r.items.length} מוצרים
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="tabular text-sm font-semibold">{formatMoney(r.total)}</p>
                      {r.status === 'confirmed' ? (
                        <Badge tone="success">נשמרה</Badge>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setReceipt(r)}>
                          המשך בדיקה
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
