import clsx from 'clsx';

/** Inline message above a form's submit button (an error by default). */
export default function FormMessage({ type = 'error', children }) {
  if (!children) return null;
  return (
    <p
      className={clsx(
        'rounded-xl px-3.5 py-2.5 text-sm',
        type === 'error' ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-700'
      )}
      role={type === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}
