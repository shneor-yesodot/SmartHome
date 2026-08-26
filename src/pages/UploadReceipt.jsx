import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Image as ImageIcon, ScanLine, Loader2, Check, Sparkles, Trash2, Plus, Store, Calendar } from 'lucide-react';
import { todayISO, formatCurrency } from '@/lib/format';
import { checkBudgetAlerts } from '@/lib/budgetAlerts';
import { toast } from '@/components/ui/use-toast';

export default function UploadReceipt() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState({ merchant: '', date: todayISO() });
  const [items, setItems] = useState([]);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setItems([]);
  };

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const llmResult = await base44.integrations.Core.InvokeLLM({
        prompt: 'נתח את החשבונית/הקבלה בתמונה. חלץ: שם בית העסק, תאריך, סכום כולל, ורשימת כל פריטי המוצרים (כל פריט עם שם, מחיר וקטגוריה מתאימה מהרשימה: מזון, תחבורה, קניות, חשבונות, בריאות, פנאי, מסעדות, אחר). החזר JSON בלבד עם מערך items.',
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            merchant: { type: 'string' },
            date: { type: 'string' },
            total: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  price: { type: 'number' },
                  category: { type: 'string' },
                },
              },
            },
          },
        },
      });
      setResult({ ...llmResult, receipt_url: file_url });
      setMeta({ merchant: llmResult.merchant || '', date: llmResult.date || todayISO() });
      const parsedItems = (llmResult.items || []).map((it) => ({
        name: it.name || '', price: String(it.price || ''), category: it.category || 'אחר',
      }));
      setItems(parsedItems.length ? parsedItems : [{ name: '', price: '', category: 'אחר' }]);
      toast({ title: 'החשבונית נותחה', description: `${parsedItems.length} פריטים זוהו` });
    } catch (err) {
      toast({ title: 'שגיאה בניתוח', description: err.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const updateItem = (i, field, value) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    setItems(next);
  };

  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const addItem = () => setItems([...items, { name: '', price: '', category: 'אחר' }]);

  const total = items.reduce((s, it) => s + (Number(it.price) || 0), 0);

  const save = async () => {
    const valid = items.filter((it) => it.name && Number(it.price) > 0);
    if (!valid.length) {
      toast({ title: 'אין פריטים תקינים', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const created = await base44.entities.Transaction.bulkCreate(
        valid.map((it) => ({
          type: 'expense',
          amount: Number(it.price),
          category: it.category,
          description: it.name,
          merchant: meta.merchant,
          date: meta.date,
          receipt_url: result?.receipt_url || null,
        }))
      );
      // check budget alerts for each created expense
      for (const t of created) {
        await checkBudgetAlerts(t);
      }
      toast({ title: `${created.length} עסקאות נוצרו`, description: `מתוך החשבונית של ${meta.merchant || 'בית העסק'}` });
      navigate('/transactions');
    } catch (err) {
      toast({ title: 'שגיאה בשמירה', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <ScanLine className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg">העלאת חשבונית / קבלה</h3>
            <p className="text-sm text-muted-foreground">ה-AI מזהה כל פריט והופך אותו לעסקה נפרדת</p>
          </div>
        </div>

        {!preview ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl py-14 cursor-pointer hover:border-primary hover:bg-accent/30 transition-all">
            <ImageIcon className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">לחצו לבחירת תמונת חשבונית</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG עד 10MB</p>
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden border border-border">
              <img src={preview} alt="חשבונית" className="w-full max-h-72 object-contain bg-muted/30" />
              <button
                onClick={() => { setFile(null); setPreview(null); setResult(null); setItems([]); }}
                className="absolute top-2 left-2 bg-black/50 text-white rounded-lg px-3 py-1 text-sm hover:bg-black/70"
              >
                החלף תמונה
              </button>
            </div>
            <Button onClick={analyze} disabled={analyzing} className="w-full h-12">
              {analyzing ? (
                <><Loader2 className="w-5 h-5 ml-2 animate-spin" />מנתח את החשבונית...</>
              ) : result ? (
                <><Check className="w-5 h-5 ml-2" />נותח — ניתן לערוך ולשמור</>
              ) : (
                <><Sparkles className="w-5 h-5 ml-2" />נתח חשבונית ב-AI</>
              )}
            </Button>
          </div>
        )}
      </Card>

      {result && (
        <Card className="p-6 animate-fade-in space-y-5">
          <div>
            <h3 className="font-heading font-bold text-base mb-4">פרטי חשבונית</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label><Store className="w-3.5 h-3.5 inline ml-1" />בית עסק</Label>
                <Input value={meta.merchant} onChange={(e) => setMeta({ ...meta, merchant: e.target.value })} placeholder="שם בית העסק" />
              </div>
              <div className="space-y-2">
                <Label><Calendar className="w-3.5 h-3.5 inline ml-1" />תאריך</Label>
                <Input type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-base">פריטים ({items.length})</h3>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4 ml-1" />פריט</Button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end rounded-xl border border-border p-3">
                  <div className="col-span-12 sm:col-span-5 space-y-1">
                    <Label className="text-xs">שם מוצר</Label>
                    <Input value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} placeholder="שם הפריט" />
                  </div>
                  <div className="col-span-5 sm:col-span-3 space-y-1">
                    <Label className="text-xs">מחיר (₪)</Label>
                    <Input type="number" step="0.01" min="0" value={it.price} onChange={(e) => updateItem(i, 'price', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="col-span-5 sm:col-span-3 space-y-1">
                    <Label className="text-xs">קטגוריה</Label>
                    <Input value={it.category} onChange={(e) => updateItem(i, 'category', e.target.value)} />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-center">
                    <button onClick={() => removeItem(i)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <span className="text-sm text-muted-foreground">סה"כ מחושב</span>
              <span className="font-heading font-bold text-lg">{formatCurrency(total)}</span>
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="w-full h-12">
            {saving ? <Loader2 className="w-5 h-5 ml-2 animate-spin" /> : <Check className="w-5 h-5 ml-2" />}
            צור {items.filter((i) => i.name && Number(i.price) > 0).length} עסקאות
          </Button>
        </Card>
      )}
    </div>
  );
}