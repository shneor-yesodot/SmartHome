import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, PiggyBank, ScanLine, Search, ShoppingBasket } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { Input, Select } from '../components/ui/Field';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import ProductCard from '../components/products/ProductCard';
import ProductDetailModal from '../components/products/ProductDetailModal';
import { useFetch } from '../hooks/useFetch';
import { useDebounce } from '../hooks/useDebounce';
import { productService } from '../services/product.service';
import { formatMoney } from '../utils/format';

export default function Products() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [selected, setSelected] = useState(null);
  const term = useDebounce(search);
  const { data, loading, error, reload } = useFetch(() => productService.list({ search: term, sort }), [term, sort]);

  const products = data?.data || [];
  const stats = data?.meta.stats;
  const scanLink = (
    <Link to="/receipts" className="btn btn-primary">
      <ScanLine className="h-4 w-4" />
      העלאת קבלה
    </Link>
  );

  return (
    <>
      <PageHeader title="מוצרים" subtitle="כל המוצרים מהקבלות שלכם, עם היסטוריית מחירים ואיפה הכי משתלם לקנות">
        {scanLink}
      </PageHeader>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <PageLoader />
      ) : (
        <>
          {stats && (stats.productsCount > 0 || term) && (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <StatCard label="מוצרים במעקב" value={stats.productsCount} icon={Package} />
                <StatCard label="סך ההוצאה על המוצרים" value={formatMoney(stats.totalSpent, { round: true })} icon={ShoppingBasket} />
                <StatCard
                  label="חיסכון אפשרי בסל"
                  value={formatMoney(stats.potentialSaving)}
                  icon={PiggyBank}
                  tone="success"
                  footnote="אם כל מוצר ייקנה במקום הזול ביותר שלו"
                />
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש מוצר" aria-label="חיפוש מוצר" />
                </div>
                <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="מיון">
                  <option value="recent">נקנו לאחרונה</option>
                  <option value="spent">ההוצאה הגבוהה ביותר</option>
                  <option value="purchases">הנקנים ביותר</option>
                  <option value="name">לפי שם</option>
                </Select>
              </div>
            </>
          )}

          {products.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={Package}
                title={term ? 'לא נמצאו מוצרים מתאימים' : 'עדיין אין מוצרים במעקב'}
                text={term ? 'נסו מילת חיפוש אחרת.' : 'העלו קבלה או חשבונית. כל מוצר בה יירשם כאן, ומהקנייה השנייה תראו השוואת מחירים.'}
                action={!term && scanLink}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.key} product={p} onOpen={setSelected} />
              ))}
            </div>
          )}
        </>
      )}

      <ProductDetailModal product={selected} onClose={() => setSelected(null)} />
    </>
  );
}
