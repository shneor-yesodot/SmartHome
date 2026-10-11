import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeCheck } from 'lucide-react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import { ErrorState, PageLoader } from '../ui/States';
import { ChartTooltip, axisProps } from '../dashboard/IncomeExpenseChart';
import { useFetch } from '../../hooks/useFetch';
import { productService } from '../../services/product.service';
import { CHART_COLORS } from '../../constants/options';
import { formatDate, formatDayNumeric, formatMoney } from '../../utils/format';

export default function ProductDetailModal({ product, onClose }) {
  return (
    <Modal open={Boolean(product)} onClose={onClose} title={product?.name || ''} size="lg">
      {product && <Detail productKey={product.key} />}
    </Modal>
  );
}

function Detail({ productKey }) {
  const { data, loading, error, reload } = useFetch(() => productService.detail(productKey), [productKey]);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const chartData = data.history.map((h) => ({ name: formatDayNumeric(h.date), price: h.unitPrice, merchant: h.merchant }));
  const stats = [
    ['מחיר אחרון', data.lastPrice],
    ['מחיר ממוצע', data.avgPrice],
    ['הכי זול', data.minPrice],
    ['הכי יקר', data.maxPrice],
  ];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface px-3 py-2.5">
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="tabular text-lg font-bold">{formatMoney(value)}</dd>
          </div>
        ))}
      </dl>

      {data.merchantsCount > 1 && (
        <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
          <span>
            הכי משתלם לקנות שוב ב<b>{data.bestMerchant}</b>, במחיר {formatMoney(data.bestPrice)} ליחידה.
            {data.potentialSaving > 0 && ` זה ${formatMoney(data.potentialSaving)} פחות ממה ששילמתם בקנייה האחרונה.`}
          </span>
        </p>
      )}

      <section>
        <h3 className="mb-2 text-sm font-bold">היסטוריית מחירים</h3>
        {chartData.length < 2 ? (
          <p className="rounded-xl bg-surface py-8 text-center text-sm text-ink-muted">אחרי קנייה נוספת של המוצר יוצג כאן גרף מגמה.</p>
        ) : (
          <div dir="ltr" className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" {...axisProps} minTickGap={24} />
                <YAxis {...axisProps} width={44} domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="price" name="מחיר ליחידה" stroke={CHART_COLORS.income} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.income }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold">השוואה בין בתי עסק</h3>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[460px] text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="table-head">בית עסק</th>
                <th className="table-head">מחיר אחרון</th>
                <th className="table-head">ממוצע</th>
                <th className="table-head">קניות</th>
                <th className="table-head">נקנה לאחרונה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.merchants.map((m, index) => (
                <tr key={m.merchant}>
                  <td className="table-cell font-medium">
                    {m.merchant}
                    {index === 0 && data.merchants.length > 1 && (
                      <Badge tone="success" className="ms-2">
                        הכי משתלם
                      </Badge>
                    )}
                  </td>
                  <td className="table-cell tabular font-semibold">{formatMoney(m.lastPrice)}</td>
                  <td className="table-cell tabular">{formatMoney(m.avgPrice)}</td>
                  <td className="table-cell tabular">{m.purchases}</td>
                  <td className="table-cell tabular text-ink-soft">{formatDate(m.lastDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="tabular text-xs text-ink-muted">
        סה״כ {data.purchases} קניות, {data.totalQuantity} יחידות, {formatMoney(data.totalSpent)}.
      </p>
    </div>
  );
}
