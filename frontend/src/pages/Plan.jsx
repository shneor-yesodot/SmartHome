import { lazy } from 'react';
import { Coins, HandHeart, RefreshCw, Target } from 'lucide-react';
import TabbedPage from '../components/layout/TabbedPage';

const TABS = [
  { key: 'budgets', label: 'תקציבים', icon: Target, component: lazy(() => import('./Budgets')) },
  { key: 'recurring', label: 'הוראות קבע', icon: RefreshCw, component: lazy(() => import('./Recurring')) },
  { key: 'maaser', label: 'מעשרות', icon: HandHeart, component: lazy(() => import('./Maaser')) },
  { key: 'goals', label: 'יעדי חיסכון', icon: Coins, component: lazy(() => import('./Goals')) },
];

/** Everything set ahead of time: limits, fixed payments, maaser and savings goals. */
export default function Plan() {
  return <TabbedPage title="תכנון" subtitle="מה שקובעים מראש: תקציבים, הוראות קבע, מעשרות ויעדי חיסכון" tabs={TABS} />;
}
