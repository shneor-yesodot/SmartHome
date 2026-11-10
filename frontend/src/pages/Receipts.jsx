import { lazy } from 'react';
import { Package, ScanLine } from 'lucide-react';
import TabbedPage from '../components/layout/TabbedPage';

const TABS = [
  { key: 'receipts', label: 'קבלות', icon: ScanLine, component: lazy(() => import('./UploadReceipt')) },
  { key: 'products', label: 'מוצרים ומחירים', icon: Package, component: lazy(() => import('./Products')) },
];

/** Receipts and the products read from them. */
export default function Receipts() {
  return <TabbedPage title="קבלות ומוצרים" subtitle="מעלים קבלה, וכל מוצר בה נשמר עם המחיר שלו" tabs={TABS} />;
}
