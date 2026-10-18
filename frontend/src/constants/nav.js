import { ArrowLeftRight, BarChart3, LayoutGrid, Package, PiggyBank, Receipt, RefreshCw, ScanLine, Settings, Target } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'דשבורד', icon: LayoutGrid, end: true },
  { to: '/transactions', label: 'עסקאות', icon: ArrowLeftRight },
  { to: '/products', label: 'מוצרים', icon: Package },
  { to: '/reports', label: 'דוחות', icon: BarChart3 },
  { to: '/budgets', label: 'תקציבים', icon: Target },
  { to: '/goals', label: 'יעדים', icon: PiggyBank },
  { to: '/recurring', label: 'הוראות קבע', icon: RefreshCw },
  { to: '/receipts', label: 'העלאת קבלה', icon: ScanLine },
  { to: '/my-receipts', label: 'הקבלות שלי', icon: Receipt },
  { to: '/settings', label: 'הגדרות', icon: Settings },
];

export const titleForPath = (pathname) => {
  const match = NAV_ITEMS.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
  return match ? match.label : 'SmartHome';
};
