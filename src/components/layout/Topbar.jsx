import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, LogOut, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const titles = {
  '/': 'דשבורד',
  '/transactions': 'עסקאות',
  '/reports': 'דוחות',
  '/budgets': 'תקציבים',
  '/recurring': 'הוראות קבע',
  '/upload': 'העלאת קבלה',
  '/settings': 'הגדרות',
};

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const title = titles[location.pathname] || 'SmartHome';

  const handleLogout = () => {
    base44.auth.logout('/login');
  };

  return (
    <header className="h-16 shrink-0 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-accent text-muted-foreground"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="font-heading font-bold text-xl text-foreground">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/50">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
            <User className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-medium text-accent-foreground max-w-[160px] truncate">
            {user?.email || 'משתמש'}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="התנתק"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}