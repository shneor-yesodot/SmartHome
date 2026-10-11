import { useState } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
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

  const confirmDelete = async () => {
    const { ok } = await run(() => categoryService.remove(deleting.id), 'הקטגוריה נמחקה');
    setDeleting(null);
    if (ok) reload();
  };

  return (
    <Card
      title="קטגוריות"
      icon={Tags}
      action={
        <Button size="sm" icon={Plus} onClick={() => setEditing(null)}>
          קטגוריה חדשה
        </Button>
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
