import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import ReceiptDropzone from '../components/receipts/ReceiptDropzone';
import ReceiptReview from '../components/receipts/ReceiptReview';
import ReceiptList from '../components/receipts/ReceiptList';
import { useAction } from '../hooks/useAction';
import { useToast } from '../context/ToastContext';
import { receiptService } from '../services/receipt.service';

export default function UploadReceipt() {
  const toast = useToast();
  const { run, pending } = useAction();
  const [saves, setSaves] = useState(0); // reloads the list after a save
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
      setSavedCount({ created: result.created, linked: result.linked });
      setReceipt(null);
      setPreviewUrl(null);
      setSaves((n) => n + 1);
    }
  };

  const cancel = async () => {
    await receiptService.remove(receipt.id).catch(() => {});
    reset();
  };

  return (
    <>
      {receipt ? (
        <ReceiptReview receipt={receipt} previewUrl={previewUrl} saving={pending} onConfirm={confirm} onCancel={cancel} />
      ) : (
        <div className="space-y-6">
          <div className="space-y-4">
            {savedCount !== null && (
              <div className="card flex flex-wrap items-center gap-4 border-brand-200 bg-brand-50 p-5">
                <CheckCircle2 className="h-8 w-8 shrink-0 text-brand-500" />
                <div className="flex-1">
                  <p className="font-bold">נשמרו {savedCount.created} עסקאות מהקבלה</p>
                  <p className="text-sm text-ink-soft">
                    {savedCount.linked && 'הן החליפו את שורת החיוב מהדף שיובא, כך שההוצאה נספרת פעם אחת. '}
                    המוצרים נוספו גם לקטלוג המוצרים, למעקב מחירים.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link to="/receipts?tab=products" className="btn btn-secondary btn-sm">
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
          <ReceiptList refreshKey={saves} onResume={setReceipt} />

        </div>
      )}
    </>
  );
}
