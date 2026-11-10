import { useRef, useState } from 'react';
import { FileUp, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import TypeToggle from '../ui/TypeToggle';
import CategoryIcon from '../ui/CategoryIcon';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Field, Input } from '../ui/Field';
import { ColorPicker, IconPicker } from '../ui/Pickers';
import { useCategories } from '../../context/CategoriesContext';
import { useAction } from '../../hooks/useAction';
import { categoryService } from '../../services/category.service';

const GROUPS = [
  { type: 'expense', title: 'קטגוריות הוצאה' },
  { type: 'income', title: 'קטגוריות הכנסה' },
];

export default function CategoryManager() {
  const { byType, reload } = useCategories();
  const { run, pending } = useAction();
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const [importing, setImporting] = useState(null);
  const fileRef = useRef(null);

  const confirmDelete = async () => {
    const { ok } = await run(() => categoryService.remove(deleting.id), 'הקטגוריה נמחקה');
    setDeleting(null);
    if (ok) reload();
  };

  const chooseFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { ok, result } = await run(() => categoryService.previewImport(file));
    if (ok) setImporting(result);
  };

  const confirmImport = async () => {
    const { ok } = await run(() => categoryService.importNames({ expense: importing.expense, income: importing.income }), 'הקטגוריות יובאו');
    setImporting(null);
    if (ok) reload();
  };

  return (
    <Card
      title="קטגוריות"
      icon={Tags}
      action={
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden aria-label="קובץ סיכום חודשי" onChange={chooseFile} />
          <Button size="sm" variant="secondary" icon={FileUp} loading={pending && !importing && !deleting} onClick={() => fileRef.current.click()}>
            ייבוא מקובץ סיכום
          </Button>
          <Button size="sm" icon={Plus} onClick={() => setEditing(null)}>
            קטגוריה חדשה
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        {GROUPS.map(({ type, title }) => (
          <div key={type}>
            <h3 className="mb-2 text-sm font-semibold text-ink-soft">{title}</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {byType(type).map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <CategoryIcon icon={c.icon} color={c.color} size={32} />
                  <span className="flex-1 truncate text-sm font-medium">{c.name}</span>
                  <button className="icon-btn" onClick={() => setEditing(c)} aria-label={`עריכת ${c.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="icon-btn hover:!bg-danger-50 hover:!text-danger-500" onClick={() => setDeleting(c)} aria-label={`מחיקת ${c.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'עריכת קטגוריה' : 'קטגוריה חדשה'} size="sm">
        {editing !== undefined && (
          <CategoryForm
            key={editing?.id || 'new'}
            category={editing}
            onClose={() => setEditing(undefined)}
            onSaved={reload}
          />
        )}
      </Modal>
      <Modal
        open={Boolean(importing)}
        onClose={() => setImporting(null)}
        title="ייבוא קטגוריות"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImporting(null)}>
              ביטול
            </Button>
            <Button loading={pending} disabled={!importing?.expense.length && !importing?.income.length} onClick={confirmImport}>
              ייבוא
            </Button>
          </>
        }
      >
        {importing && (
          <div className="space-y-3 text-sm">
            <p>
              <b>הוצאות ({importing.expense.length}):</b> {importing.expense.join(', ') || 'אין חדשות'}
            </p>
            <p>
              <b>הכנסות ({importing.income.length}):</b> {importing.income.join(', ') || 'אין חדשות'}
            </p>
            {importing.removed.length > 0 && (
              <p className="text-ink-soft">
                <b>יוסרו ברירות מחדל שלא בשימוש:</b> {importing.removed.join(', ')}
              </p>
            )}
            <p className="text-ink-muted">קטגוריות עם עסקאות, תקציב או הוראת קבע לא יימחקו. מעקב המעשר נשמר.</p>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="מחיקת קטגוריה"
        message={`למחוק את הקטגוריה "${deleting?.name}"? ניתן למחוק רק קטגוריה שאין לה עסקאות.`}
        loading={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  );
}

function CategoryForm({ category, onClose, onSaved }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState({
    name: category?.name || '',
    type: category?.type || 'expense',
    icon: category?.icon || 'Tag',
    color: category?.color || '#12A05C',
  });

  const submit = async (e) => {
    e.preventDefault();
    const { name, type, icon, color } = form;
    const { ok } = await run(
      () => (category ? categoryService.update(category.id, { name, icon, color }) : categoryService.create({ name, type, icon, color })),
      category ? 'הקטגוריה עודכנה' : 'הקטגוריה נוספה'
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {!category && <TypeToggle value={form.type} onChange={(type) => setForm((f) => ({ ...f, type }))} />}
      <Field label="שם הקטגוריה">
        <Input required maxLength={40} autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </Field>
      <Field label="צבע">
        <ColorPicker value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
      </Field>
      <Field label="אייקון">
        <IconPicker value={form.icon} color={form.color} onChange={(icon) => setForm((f) => ({ ...f, icon }))} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          ביטול
        </Button>
        <Button type="submit" loading={pending}>
          שמירה
        </Button>
      </div>
    </form>
  );
}
