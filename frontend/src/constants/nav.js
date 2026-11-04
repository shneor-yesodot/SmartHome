import { ArrowLeftRight, BarChart3, Coins, CreditCard, HandHeart, LayoutGrid, Package, Receipt, RefreshCw, ScanLine, Settings, Target } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'דשבורד', icon: LayoutGrid, end: true },
  { to: '/transactions', label: 'עסקאות', icon: ArrowLeftRight },
  { to: '/cards', label: 'כרטיסי אשראי', icon: CreditCard },
  { to: '/reports', label: 'דוחות', icon: BarChart3 },
  { to: '/recurring', label: 'הוראות קבע', icon: RefreshCw },
  { to: '/maaser', label: 'מעשרות', icon: HandHeart },
  { to: '/budgets', label: 'תקציבים', icon: Target },
  { to: '/goals', label: 'יעדים', icon: Coins },
  { to: '/products', label: 'מוצרים', icon: Package },
  { to: '/receipts', label: 'העלאת קבלה', icon: ScanLine },
  { to: '/my-receipts', label: 'הקבלות שלי', icon: Receipt },
  { to: '/settings', label: 'הגדרות', icon: Settings },
];

export const titleForPath = (pathname) => {
  const match = NAV_ITEMS.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
  return match ? match.label : 'SmartHome';
};
