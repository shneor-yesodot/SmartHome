import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Target, RefreshCw, ScanLine, Settings, Home, BarChart3 } from 'lucide-react';

const navItems = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'עסקאות', icon: ArrowLeftRight },
  { to: '/reports', label: 'דוחות', icon: BarChart3 },
  { to: '/budgets', label: 'תקציבים', icon: Target },
  { to: '/recurring', label: 'הוראות קבע', icon: RefreshCw },
  { to: '/upload', label: 'העלאת קבלה', icon: ScanLine },
  { to: '/settings', label: 'הגדרות', icon: Settings },
];

export default function Sidebar({ onNavigate }) {
  return (
    <aside className="w-64 shrink-0 h-full bg-sidebar border-l border-sidebar-border flex flex-col">
      <div className="px-6 py-7 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
          <Home className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-lg text-sidebar-foreground leading-none">SmartHome</h1>
          <p className="text-xs text-muted-foreground mt-1">ניהול משק בית חכם</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="rounded-xl bg-accent/60 p-4 text-center">
          <p className="text-xs text-muted-foreground">גרסה</p>
          <p className="font-heading font-bold text-sm text-accent-foreground">1.0.0</p>
        </div>
      </div>
    </aside>
  );
}