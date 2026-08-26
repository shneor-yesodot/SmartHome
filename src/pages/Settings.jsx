import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { User, Plus, Trash2, Tag, Mail, Loader2, LogOut } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import PageLoader from '@/components/common/PageLoader';
import EmptyState from '@/components/common/EmptyState';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'expense', color: '#16a34a' });

  const load = async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
    } catch {}
    const cats = await base44.entities.Category.list();
    setCategories(cats);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addCategory = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.Category.create({ name: form.name, type: form.type, color: form.color });
      setOpen(false);
      setForm({ name: '', type: 'expense', color: '#16a34a' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = async (c) => {
    if (!confirm(`למחוק קטגוריה "${c.name}"?`)) return;
    await base44.entities.Category.delete(c.id);
    load();
  };

  const handleLogout = () => base44.auth.logout('/login');

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Card className="p-6">
        <h3 className="font-heading font-bold text-lg mb-5">פרופיל משתמש</h3>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <User className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Mail className="w-4 h-4 text-muted-foreground" />
              {user?.email || 'משתמש'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              תפקיד: {user?.role === 'admin' ? 'מנהל' : 'משתמש'}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="text-destructive hover:text-destructive">
            <LogOut className="w-4 h-4 ml-2" />התנתק
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-heading font-bold text-lg">ניהול קטגוריות</h3>
            <p className="text-sm text-muted-foreground">קטגוריות לסיווג עסקאות</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 ml-2" />קטגוריה</Button>
        </div>

        {categories.length === 0 ? (
          <EmptyState icon={Tag} title="אין קטגוריות" description="הוסיפו קטגוריות כדי לסווג עסקאות" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color || '#16a34a' }} />
                  <span className="text-sm font-medium truncate">{c.name}</span>
                </div>
                <button onClick={() => removeCategory(c)} className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>קטגוריה חדשה</DialogTitle></DialogHeader>
          <form onSubmit={addCategory} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cname">שם קטגוריה</Label>
              <Input id="cname" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="לדוגמה: מזון" />
            </div>
            <div className="space-y-2">
              <Label>סוג</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm({ ...form, type: 'expense' })}
                  className={`py-2.5 rounded-xl text-sm font-semibold ${form.type === 'expense' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}`}>הוצאה</button>
                <button type="button" onClick={() => setForm({ ...form, type: 'income' })}
                  className={`py-2.5 rounded-xl text-sm font-semibold ${form.type === 'income' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>הכנסה</button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>צבע</Label>
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full h-10 rounded-lg border border-border cursor-pointer" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}שמור</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}