import clsx from 'clsx';

/** A small row of mutually exclusive options, e.g. Gregorian / Hebrew months. */
export default function Segmented({ options, value, onChange, label, disabled }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-[10px] px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60',
            value === o.value ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted hover:text-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
