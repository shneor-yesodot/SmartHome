import { useLocation } from 'react-router-dom';
import { LogOut, Menu, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { titleForPath } from '../../constants/nav';
import LiveClock from './LiveClock';

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between gap-3 border-b border-line bg-white px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <button className="icon-btn lg:hidden" onClick={onMenu} aria-label="פתיחת התפריט">
          <Menu className="h-5 w-5" />
        </button>
        <p className="text-lg font-bold">{titleForPath(pathname)}</p>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <LiveClock />
        <div className="hidden max-w-[220px] items-center sm:flex gap-2 rounded-full bg-brand-50 py-1 pe-1 ps-4">
          <span className="truncate text-sm text-ink-soft" dir="ltr" title={user?.email}>
            {user?.email}
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
            <User className="h-4 w-4" />
          </span>
        </div>
        <button className="icon-btn" onClick={logout} aria-label="התנתקות" title="התנתקות">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
