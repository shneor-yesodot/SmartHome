import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, HandHeart, Plus, Target, Trash2, Wallet } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import PeriodNav from '../components/ui/PeriodNav';
import StatCard from '../components/ui/StatCard';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ErrorState, PageLoader } from '../components/ui/States';
import { ChartTooltip, axisProps } from '../components/ui/ChartTooltip';
import MaaserSettings from '../components/maaser/MaaserSettings';
import DonationForm from '../components/maaser/DonationForm';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { useAction } from '../hooks/useAction';
import { maaserService } from '../services/maaser.service';
import { transactionService } from '../services/transaction.service';
import { formatDay } from '../utils/hebrewDate';
import { formatMoney } from '../utils/format';
import { CHART_COLORS } from '../constants/options';

const targetText = (s, income) =>
  s.mode === 'fixed' ? 'סכום קבוע בכל חודש' : `${s.percent}% מהכנסות של ${formatMoney(income, { round: true })}`;

export default function Maaser() {
  const { user } = useAuth();
  const calendar = user?.calendar || 'gregorian';
  const [anchor, setAnchor] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const { run, pending } = useAction();

  const { data, loading, error, reload } = useFetch(() => maaserService.overview({ calendar, date: anchor || undefined }), [calendar, anchor]);

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <PageLoader />;

  const done = data.remaining <= 0;

  const confirmDelete = async () => {
    const { ok } = await run(() => transactionService.remove(deleting.id), 'התרומה נמחקה');
    if (ok) {
      setDeleting(null);
      reload();
    }
  };

  return (
    <>
      <PageHeader title="מעשרות וצדקה" subtitle="היעד החודשי, מה שניתן, ולמי">
        <PeriodNav
          period={data.period}
          calendar={calendar}
          onAnchorChange={setAnchor}
        />
        <Button icon={Plus} onClick={() => setFormOpen(true)}>
          תרומה חדשה
        </Button>
      </PageHeader>

      <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="היעד החודש" value={formatMoney(data.target, { round: true })} icon={Target} footnote={targetText(data.settings, data.income)} />
          <StatCard label="ניתן החודש" value={formatMoney(data.given, { round: true })} icon={HandHeart} tone="success" footnote={`${data.donations.length} תרומות`} />
          <StatCard
            label={done ? 'ניתן מעבר ליעד' : 'נשאר לתת'}
            value={formatMoney(Math.abs(data.remaining), { round: true })}
            icon={done ? CheckCircle2 : Wallet}
            tone={done ? 'success' : 'danger'}
            footnote={done ? 'היעד הושלם, בעז״ה' : 'היעד החודש והיתרה מחודשים קודמים'}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card title={`תרומות ב${data.period.label}`} icon={HandHeart} className="min-w-0">
            {data.donations.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">עוד לא נרשמו תרומות בחודש הזה.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.donations.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{d.recipient || d.description}</p>
                      <p className="text-xs text-ink-muted">
                        {formatDay(d.date, data.period.calendar)}
                        {d.notes && ` · ${d.notes}`}
                      </p>
                    </div>
                    <span className="tabular shrink-0 font-bold">{formatMoney(d.amount)}</span>
                    <button type="button" className="icon-btn h-8 w-8 hover:!bg-danger-50 hover:!text-danger-500" onClick={() => setDeleting(d)} aria-label={`מחיקת התרומה ל${d.recipient}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <MaaserSettings key={JSON.stringify(data.settings)} settings={data.settings} onSaved={reload} />
        </div>

        <Card title="יעד מול נתינה - 12 חודשים">
          <div dir="ltr" className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.history} barGap={4} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" minTickGap={4} />
                <YAxis {...axisProps} width={52} tickFormatter={(v) => v.toLocaleString('he-IL')} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#EDF8F2' }} labelFormatter={(_, payload) => payload?.[0]?.payload.label} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                <Bar dataKey="target" name="יעד" fill="#C9D3CD" radius={[6, 6, 0, 0]} maxBarSize={24} />
                <Bar dataKey="given" name="ניתן" fill="#B7791F" radius={[6, 6, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <DonationForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} recipients={data.byRecipient.map((r) => r.recipient)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="מחיקת תרומה"
        message={`למחוק את התרומה ל${deleting?.recipient || ''} על סך ${formatMoney(deleting?.amount || 0)}?`}
        loading={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
