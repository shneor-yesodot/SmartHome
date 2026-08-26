import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2, Download, Upload, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency, formatDate, isSameMonth } from '@/lib/format';
import PageLoader from '@/components/common/PageLoader';
import EmptyState from '@/components/common/EmptyState';
import TransactionForm from '@/components/transactions/TransactionForm';
import ImportExcel from '@/components/transactions/ImportExcel';

const TYPE_LABELS = { all: 'הכל', income: 'הכנסות', expense: 'הוצאות' };

function exportCSV(transactions) {
  const headers = ['תאריך', 'סוג', 'סכום', 'קטגוריה', 'תיאור', 'הערות'];
  const rows = transactions.map((t) => [
    t.date, t.type === 'income' ? 'הכנסה' : 'הוצאה', t.amount, t.category, t.description || '', t.notes || '',
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `עסקאות_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    const [txns, cats] = await Promise.all([
      base44.entities.Transaction.list('-date', 500),
      base44.entities.Category.list(),
    ]);
    setTransactions(txns);
    setCategories(cats);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;
      if (search && !`${t.description} ${t.category} ${t.notes || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filterType, filterCategory, search]);

  const handleDelete = async (t) => {
    if (!confirm(`למחוק את "${t.description}"?`)) return;
    await base44.entities.Transaction.delete(t.id);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{filtered.length} עסקאות</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 ml-2" />יבוא Excel
          </Button>
          <Button variant="outline" onClick={() => exportCSV(filtered)}>
            <Download className="w-4 h-4 ml-2" />ייצוא Excel
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 ml-2" />עסקה חדשה
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש חופשי..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full"><SelectValue placeholder="כל הקטגוריות" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הקטגוריות</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="אין עסקאות"
            description="הוסיפו את העסקה הראשונה שלכם"
            action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="w-4 h-4 ml-2" />הוסף עסקה</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-right font-medium px-4 py-3">תאריך</th>
                  <th className="text-right font-medium px-4 py-3">תיאור</th>
                  <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">קטגוריה</th>
                  <th className="text-right font-medium px-4 py-3">סכום</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                          {t.type === 'income'
                            ? <ArrowUpRight className="w-4 h-4 text-primary" />
                            : <ArrowDownRight className="w-4 h-4 text-destructive" />}
                        </div>
                        <div>
                          <p className="font-medium">{t.description}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{t.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{t.category}</td>
                    <td className={`px-4 py-3 font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-primary' : ''}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => { setEditing(t); setFormOpen(true); }}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <TransactionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        editingTransaction={editing}
        categories={categories}
      />

      <ImportExcel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={load}
      />
    </div>
  );
}