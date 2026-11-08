import { useState } from 'react';
import { ExternalLink, RefreshCw, Sheet } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Segmented from '../ui/Segmented';
import Switch from '../ui/Switch';
import { Field, Input } from '../ui/Field';
import { useFetch } from '../../hooks/useFetch';
import { useAction } from '../../hooks/useAction';
import { sheetsService } from '../../services/sheets.service';
import { formatDate } from '../../utils/format';

const MODES = [
  { value: 'backup', label: 'גיבוי בלבד' },
  { value: 'two-way', label: 'דו-כיווני' },
];

const MODE_HELP = {
  backup: 'המערכת כותבת לגיליון, ועריכות בגיליון נדרסות. מתאים לרשת ביטחון.',
  'two-way': 'עריכות ושורות חדשות בגיליון נכנסות למערכת. מחיקת שורה בגיליון לא מוחקת מהמערכת, ואם שורה נערכה בשני הצדדים, המערכת גוברת.',
};

function SyncReport({ report }) {
  const lines = [
    report.created > 0 && `נוספו ${report.created} עסקאות מהגיליון`,
    report.updated > 0 && `עודכנו ${report.updated} עסקאות מהגיליון`,
    report.conflicts?.length > 0 && `${report.conflicts.length} שורות נערכו בשני הצדדים, ונשמר הערך שבמערכת: ${report.conflicts.map((c) => c.description).join(', ')}`,
    report.restored?.length > 0 && `${report.restored.length} שורות שנמחקו מהגיליון הוחזרו אליו, כי הן עדיין קיימות במערכת: ${report.restored.map((r) => r.description).join(', ')}`,
    ...(report.invalid || []).map((r) => `שורה ${r.rowNumber} לא נקראה ונשארה בגיליון: ${r.error}`),
  ].filter(Boolean);
  return (
    <div className="rounded-xl bg-surface p-3 text-sm">
      <p className="font-semibold">{report.pushed} עסקאות נכתבו לגיליון.</p>
      {lines.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 ps-5 text-ink-soft">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SheetsCard() {
  const { data: status, reload } = useFetch(sheetsService.status, []);
  const { run, pending } = useAction();
  const [spreadsheet, setSpreadsheet] = useState('');
  const [mode, setMode] = useState('backup');
  const [report, setReport] = useState(null);

  if (!status) return null;

  const connect = async (e) => {
    e.preventDefault();
    const { ok } = await run(() => sheetsService.connect({ spreadsheet, mode }), 'הגיליון חובר');
    if (ok) reload();
  };

  const sync = async () => {
    const { ok, result } = await run(() => sheetsService.sync(), 'הסנכרון הסתיים');
    if (ok) setReport(result);
    reload();
  };

  const change = async (data) => {
    const { ok } = await run(() => sheetsService.update(data));
    if (ok) reload();
  };

  const disconnect = async () => {
    const { ok } = await run(() => sheetsService.disconnect(), 'הגיליון נותק. הקובץ עצמו נשאר ב-Drive שלכם');
    if (ok) {
      setReport(null);
      reload();
    }
  };

  return (
    <Card title="Google Sheets" icon={Sheet} action={status.connected ? <Badge tone="success">מחובר</Badge> : null}>
      {!status.configured ? (
        <p className="text-sm text-ink-soft">החיבור עדיין לא הוגדר בשרת. צריך להגדיר חשבון שירות של Google במשתנה GOOGLE_SERVICE_ACCOUNT_JSON (ההוראות ב-README).</p>
      ) : !status.connected ? (
        <form onSubmit={connect} className="space-y-4">
          <ol className="list-decimal space-y-1 ps-5 text-sm text-ink-soft">
            <li>צרו גיליון חדש ב-Google Sheets.</li>
            <li>
              שתפו אותו כעורך עם <span dir="ltr" className="select-all break-all font-mono text-xs text-ink">{status.serviceEmail}</span>
            </li>
            <li>הדביקו כאן את הקישור אליו.</li>
          </ol>
          <Field label="קישור לגיליון">
            <Input dir="ltr" required value={spreadsheet} onChange={(e) => setSpreadsheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
          </Field>
          <div>
            <Segmented label="אופן הסנכרון" options={MODES} value={mode} onChange={setMode} />
            <p className="mt-2 text-sm text-ink-muted">{MODE_HELP[mode]}</p>
          </div>
          <Button type="submit" loading={pending} disabled={!spreadsheet.trim()}>
            חיבור הגיליון
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <Segmented label="אופן הסנכרון" options={MODES} value={status.mode} onChange={(value) => change({ mode: value })} />
            <p className="mt-2 text-sm text-ink-muted">{MODE_HELP[status.mode]}</p>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            סנכרון אוטומטי בכל לילה
            <Switch checked={status.autoSync} onChange={(value) => change({ autoSync: value })} label="סנכרון אוטומטי בכל לילה" />
          </label>
          <p className="text-sm text-ink-soft">{status.lastSyncAt ? `סנכרון אחרון: ${formatDate(status.lastSyncAt)}` : 'עדיין לא בוצע סנכרון.'}</p>
          {status.lastError && <p className="text-sm text-danger-600">הסנכרון האחרון נכשל: {status.lastError}</p>}
          {report && <SyncReport report={report} />}
          <div className="flex flex-wrap gap-2">
            <Button icon={RefreshCw} loading={pending} onClick={sync}>
              סנכרון עכשיו
            </Button>
            <a className="btn btn-secondary" href={`https://docs.google.com/spreadsheets/d/${status.spreadsheetId}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              פתיחת הגיליון
            </a>
            <Button variant="ghost" onClick={disconnect}>
              ניתוק
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
