import clsx from 'clsx';

const TONES = {
  success: 'bg-brand-50 text-brand-700',
  warning: 'bg-warn-50 text-warn-600',
  danger: 'bg-danger-50 text-danger-600',
  neutral: 'bg-surface text-ink-soft border border-line',
};

export default function Badge({ tone = 'neutral', icon: Icon, children, className }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', TONES[tone], className)}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}
