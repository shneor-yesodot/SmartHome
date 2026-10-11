import clsx from 'clsx';

const TONES = { success: 'bg-brand-500', warning: 'bg-warn-500', danger: 'bg-danger-500' };
const STROKES = { success: '#12A05C', warning: '#D98A0B', danger: '#D93F3F' };

export function ProgressBar({ value, tone = 'success', marker, className }) {
  const width = Math.min(Math.max(value, 0), 100);
  return (
    <div className={clsx('relative h-2 rounded-full bg-brand-50', className)} role="progressbar" aria-valuenow={Math.round(width)} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx('h-full rounded-full transition-[width] duration-500', TONES[tone])} style={{ width: `${width}%` }} />
      {/* Optional marker, e.g. "where you should be by today" */}
      {marker !== undefined && marker > 0 && marker < 100 && (
        <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink/50" style={{ insetInlineStart: `${marker}%` }} title="היעד להיום" />
      )}
    </div>
  );
}

export function ProgressRing({ value, size = 120, stroke = 12, tone = 'success', color, children }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EDF8F2" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color || STROKES[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
