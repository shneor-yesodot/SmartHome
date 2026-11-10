import { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import PageHeader, { EmbeddedPage } from '../ui/PageHeader';
import { PageLoader } from '../ui/States';

/**
 * One screen made of several related screens, one per tab. The tab is in the address
 * (?tab=), so links, refresh and the back button keep it.
 */
export default function TabbedPage({ title, subtitle, tabs }) {
  const [params, setParams] = useSearchParams();
  const active = tabs.find((t) => t.key === params.get('tab')) || tabs[0];
  const Screen = active.component;

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div role="tablist" aria-label={title} className="mb-6 grid grid-flow-col auto-cols-fr border-b border-line sm:flex sm:gap-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === active.key}
            onClick={() => setParams(key === tabs[0].key ? {} : { tab: key })}
            className={clsx(
              '-mb-px flex items-center justify-center gap-2 whitespace-nowrap border-b-2 px-1 py-2.5 text-sm transition-colors sm:px-4 sm:text-[15px]',
              key === active.key ? 'border-brand-500 font-semibold text-brand-700' : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            {Icon && <Icon className="hidden h-4 w-4 sm:block" />}
            {label}
          </button>
        ))}
      </div>
      <EmbeddedPage.Provider value={true}>
        <Suspense fallback={<PageLoader />}>
          <Screen key={active.key} />
        </Suspense>
      </EmbeddedPage.Provider>
    </>
  );
}
