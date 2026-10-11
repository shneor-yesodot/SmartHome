import clsx from 'clsx';
import { TrendingDown, TrendingUp } from 'lucide-react';

/** Expense / income switch. */
export default function TypeToggle({ value, onChange }) {
  const options = [
    { value: 'expense', label: 'הוצאה', icon: TrendingDown, active: 'bg-danger-50 text-danger-600 border-danger-500' },
    { value: 'income', label: 'הכנסה', icon: TrendingUp, active: 'bg-brand-50 text-brand-700 border-brand-500' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="סוג העסקה">
      {options.map(({ value: v, label, icon: Icon, active }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={clsx(
            'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-colors',
            value === v ? active : 'border-line bg-white text-ink-soft hover:bg-surface'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
