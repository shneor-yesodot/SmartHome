import clsx from 'clsx';

const TONES = {
  success: { value: 'text-brand-600', tile: 'bg-brand-50 text-brand-600' },
  danger: { value: 'text-danger-500', tile: 'bg-danger-50 text-danger-500' },
  neutral: { value: 'text-ink', tile: 'bg-brand-50 text-brand-700' },
  warning: { value: 'text-warn-600', tile: 'bg-warn-50 text-warn-600' },
};

/** Label on top, big figure below, tinted icon tile on the far side. */
export default function StatCard({ label, value, icon: Icon, tone = 'neutral', footnote }) {
  const t = TONES[tone];
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="pt-2 text-sm text-ink-soft">{label}</span>
        {Icon && (
          <span className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', t.tile)}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      <p className={clsx('tabular mt-2 text-[26px] font-extrabold leading-tight', t.value)}>{value}</p>
      {footnote && <p className="mt-1 text-xs text-ink-muted">{footnote}</p>}
    </div>
  );
}
