import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input, Select } from '../ui/Field';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoriesContext';
import { useFetch } from '../../hooks/useFetch';
import { accountService } from '../../services/account.service';
import { reportService } from '../../services/report.service';

const isoDay = (date) => date.slice(0, 10);
const MONTHS_BACK = 36;

export const EMPTY_FILTERS = { search: '', type: '', category: '', account: '', from: '', to: '' };

export default function TransactionFilters({ filters, onChange }) {
  const { user } = useAuth();
  const { categories } = useCategories();
  const calendar = user?.calendar || 'gregorian';
  const [open, setOpen] = useState(false);
  const set = (field) => (e) => onChange({ ...filters, [field]: e.target.value });
  const visibleCategories = filters.type ? categories.filter((c) => c.type === filters.type) : categories;
  const isFiltered = Object.values(filters).some(Boolean);
  const { data: accounts } = useFetch(accountService.list, []);

  // A month, in either calendar, fills in the date range
  const { data: periods } = useFetch(() => reportService.periods({ calendar, count: MONTHS_BACK }), [calendar]);
  const month = periods?.find((p) => isoDay(p.start) === filters.from && isoDay(p.end) === filters.to)?.key || '';
  const pickMonth = (key) => {
    const p = periods.find((item) => item.key === key);
    onChange({ ...filters, from: p ? isoDay(p.start) : '', to: p ? isoDay(p.end) : '' });
  };

  return (
    <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <Input className="ps-9" value={filters.search} onChange={set('search')} placeholder="חיפוש לפי תיאור, עסק או מוצר" aria-label="חיפוש" />
      </div>
      <button type="button" className="btn btn-secondary sm:hidden" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <SlidersHorizontal className="h-4 w-4" />
        {open ? 'הסתרת הסינון' : isFiltered ? 'סינון (פעיל)' : 'סינון'}
      </button>
      {/* On a phone the list comes first: the filters open on request */}
      <div className={open ? 'contents' : 'hidden sm:contents'}>
      <Select value={filters.type} onChange={(e) => onChange({ ...filters, type: e.target.value, category: '' })} aria-label="סוג">
        <option value="">כל הסוגים</option>
        <option value="expense">הוצאות</option>
        <option value="income">הכנסות</option>
      </Select>
      <Select value={filters.category} onChange={set('category')} aria-label="קטגוריה">
        <option value="">כל הקטגוריות</option>
        {visibleCategories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {!filters.type ? (c.type === 'income' ? ' (הכנסה)' : '') : ''}
          </option>
        ))}
      </Select>
      <Select value={filters.account} onChange={set('account')} aria-label="כרטיס או חשבון">
        <option value="">כל הכרטיסים והחשבונות</option>
        {accounts?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <div className="flex min-w-0 gap-2">
        <Select className="min-w-0 flex-1" value={month} onChange={(e) => pickMonth(e.target.value)} aria-label="חודש">
          <option value="">כל החודשים</option>
          {periods?.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
      <Input type="date" value={filters.from} onChange={set('from')} aria-label="מתאריך" title="מתאריך" />
      <Input type="date" value={filters.to} min={filters.from} onChange={set('to')} aria-label="עד תאריך" title="עד תאריך" />
      <button className="btn btn-ghost" disabled={!isFiltered} onClick={() => onChange(EMPTY_FILTERS)}>
        <X className="h-4 w-4" />
        ניקוי
      </button>
      </div>
    </div>
  );
}
