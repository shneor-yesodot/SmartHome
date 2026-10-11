import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import Logo from './Logo';
import { NAV_ITEMS } from '../../constants/nav';

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Backdrop for the mobile drawer */}
      {open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={onClose} />}

      <aside
        className={clsx(
          'fixed inset-y-0 start-0 z-40 flex w-60 flex-col border-e border-line bg-white transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex h-[72px] items-center justify-between border-b border-line px-5">
          <Logo />
          <button className="icon-btn lg:hidden" onClick={onClose} aria-label="סגירת התפריט">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="ניווט ראשי">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] transition-colors',
                  isActive ? 'bg-brand-500 font-semibold text-white' : 'text-ink-soft hover:bg-brand-50 hover:text-ink'
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
