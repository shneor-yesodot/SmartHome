import clsx from 'clsx';

/** Label + control + optional hint, used by every form. */
export function Field({ label, hint, className, children }) {
  return (
    <label className={clsx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }) {
  return <input className={clsx('input', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={clsx('input appearance-none bg-[length:16px] bg-[left_12px_center] bg-no-repeat pe-3 ps-9', className)} style={{ backgroundImage: CHEVRON }} {...props}>
      {children}
    </select>
  );
}

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237C8B83' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";
