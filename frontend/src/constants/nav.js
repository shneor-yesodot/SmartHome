import { ArrowLeftRight, BarChart3, CreditCard, LayoutGrid, Receipt, Settings, Target } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'ראשי', icon: LayoutGrid, end: true },
  { to: '/transactions', label: 'עסקאות', icon: ArrowLeftRight },
  { to: '/cards', label: 'כרטיסים', icon: CreditCard },
  { to: '/reports', label: 'דוחות', icon: BarChart3 },
  { to: '/plan', label: 'תכנון', icon: Target },
  { to: '/receipts', label: 'קבלות ומוצרים', icon: Receipt },
];

export const SETTINGS_ITEM = { to: '/settings', label: 'הגדרות', icon: Settings };

export const titleForPath = (pathname) => {
  const match = [...NAV_ITEMS, SETTINGS_ITEM].find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
  return match ? match.label : 'SmartHome';
};
