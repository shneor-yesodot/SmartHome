import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Camera, Loader2, ScanLine } from 'lucide-react';

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_MB = 8;

/** Click or drag a receipt image / PDF. Basic checks run here; the server validates again. */
export default function ReceiptDropzone({ scanning, onFile, onInvalid }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handle = (file) => {
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) return onInvalid('ניתן להעלות תמונה (JPG, PNG, WEBP) או קובץ PDF בלבד');
    if (file.size > MAX_MB * 1024 * 1024) return onInvalid(`הקובץ גדול מדי (עד ${MAX_MB}MB)`);
    onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!scanning) handle(e.dataTransfer.files?.[0]);
      }}
      className={clsx(
        'flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors',
        dragging ? 'border-brand-500 bg-brand-50' : 'border-brand-200 bg-white'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
        {scanning ? <Loader2 className="h-8 w-8 animate-spin" /> : <ScanLine className="h-8 w-8" />}
      </span>
      {scanning ? (
        <div role="status">
          <p className="text-lg font-bold">קוראים את הקבלה</p>
          <p className="mt-1 text-sm text-ink-muted">מזהים את בית העסק, התאריך וכל אחד מהמוצרים. זה לוקח כמה שניות.</p>
        </div>
      ) : (
        <>
          <div>
            <p className="text-lg font-bold">גררו לכאן קבלה או חשבונית</p>
            <p className="mt-1 text-sm text-ink-muted">תמונה או PDF, עד {MAX_MB}MB. כל מוצר בקבלה יהפוך לעסקה נפרדת.</p>
          </div>
          <button className="btn btn-primary" onClick={() => inputRef.current.click()}>
            <Camera className="h-4 w-4" />
            בחירת קובץ או צילום
          </button>
        </>
      )}
    </div>
  );
}
