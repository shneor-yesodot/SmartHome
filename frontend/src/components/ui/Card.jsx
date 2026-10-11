import clsx from 'clsx';

/** White surface with an optional header (icon + title on one side, action on the other). */
export default function Card({ title, icon: Icon, action, className, bodyClassName, children }) {
  return (
    <section className={clsx('card p-5', className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold">
            {Icon && <Icon className="h-[18px] w-[18px] text-brand-500" />}
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
