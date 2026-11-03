import { Search, X } from 'lucide-react';
import { Input, Select } from '../ui/Field';
import { useCategories } from '../../context/CategoriesContext';
import { useFetch } from '../../hooks/useFetch';
import { reportService } from '../../services/report.service';

const isoDay = (date) => date.slice(0, 10);

export const EMPTY_FILTERS = { search: '', type: '', category: '', from: '', to: '' };

export default function TransactionFilters({ filters, onChange }) {
  const { categories } = useCategories();
  const set = (field) => (e) => onChange({ ...filters, [field]: e.target.value });
  const visibleCategories = filters.type ? categories.filter((c) => c.type === filters.type) : categories;
  const isFiltered = Object.values(filters).some(Boolean);

  // A month (Gregorian or Hebrew, by the user's setting) fills in the date range
  const { data: periods } = useFetch(() => reportService.periods(), []);
  const month = periods?.find((p) => isoDay(p.start) === filters.from && isoDay(p.end) === filters.to)?.key || '';
  const pickMonth = (key) => {
    const p = periods.find((item) => item.key === key);
    onChange({ ...filters, from: p ? isoDay(p.start) : '', to: p ? isoDay(p.end) : '' });
  };

  return (
    <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.2fr_1.2fr_1fr_1fr_auto]">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <Input className="ps-9" value={filters.search} onChange={set('search')} placeholder="חיפוש לפי תיאור, עסק או מוצר" aria-label="חיפוש" />
      </div>
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
      <Select value={month} onChange={(e) => pickMonth(e.target.value)} aria-label="חודש">
        <option value="">כל החודשים</option>
        {periods?.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </Select>
      <Input type="date" value={filters.from} onChange={set('from')} aria-label="מתאריך" title="מתאריך" />
      <Input type="date" value={filters.to} min={filters.from} onChange={set('to')} aria-label="עד תאריך" title="עד תאריך" />
      <button className="btn btn-ghost" disabled={!isFiltered} onClick={() => onChange(EMPTY_FILTERS)}>
        <X className="h-4 w-4" />
        ניקוי
      </button>
    </div>
  );
}
