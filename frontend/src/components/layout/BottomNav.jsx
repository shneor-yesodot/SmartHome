import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeftRight, CreditCard, LayoutGrid, Menu, Plus } from 'lucide-react';

const linkClass = ({ isActive }) =>
  clsx('flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px]', isActive ? 'font-semibold text-brand-600' : 'text-ink-muted');

/** Phones: the screens used on the move within thumb's reach, and one tap to a new expense. */
export default function BottomNav({ onMenu }) {
  const navigate = useNavigate();
  return (
    <nav aria-label="ניווט מהיר" className="pb-safe fixed inset-x-0 bottom-0 z-20 flex items-center border-t border-line bg-white lg:hidden">
      <NavLink to="/" end className={linkClass}>
        <LayoutGrid className="h-5 w-5" />
        ראשי
      </NavLink>
      <NavLink to="/transactions" className={linkClass}>
        <ArrowLeftRight className="h-5 w-5" />
        עסקאות
      </NavLink>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => navigate('/transactions?new=1')}
          aria-label="הוצאה חדשה"
          className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-pop active:bg-brand-700"
        >
          <Plus className="h-7 w-7" />
        </button>
      </div>
      <NavLink to="/cards" className={linkClass}>
        <CreditCard className="h-5 w-5" />
        כרטיסים
      </NavLink>
      <button type="button" onClick={onMenu} className={linkClass({ isActive: false })}>
        <Menu className="h-5 w-5" />
        עוד
      </button>
    </nav>
  );
}
