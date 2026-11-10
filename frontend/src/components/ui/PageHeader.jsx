import { createContext, useContext } from 'react';

/** True inside a tab of a bigger screen: the screen already shows the title. */
export const EmbeddedPage = createContext(false);

export default function PageHeader({ title, subtitle, children }) {
  const embedded = useContext(EmbeddedPage);
  if (embedded) {
    if (!subtitle && !children) return null;
    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {subtitle && <p className="text-sm text-ink-soft">{subtitle}</p>}
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    );
  }
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
