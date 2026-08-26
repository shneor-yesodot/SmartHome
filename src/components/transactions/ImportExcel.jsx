import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, Loader2, Check, AlertCircle } from 'lucide-react';
import { todayISO } from '@/lib/format';
import { checkBudgetAlerts } from '@/lib/budgetAlerts';
import { toast } from '@/components/ui/use-toast';

export default function ImportExcel({ open, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState([]);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsing(true);
    setPreview([]);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            transactions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  amount: { type: 'number' },
                  category: { type: 'string' },
                  description: { type: 'string' },
                  merchant: { type: 'string' },
                  date: { type: 'string' },
                },
              },
            },
          },
        },
      });
      const rows = result.output?.transactions || result.output || [];
      const normalized = (Array.isArray(rows) ? rows : []).map((r) => ({
        type: (r.type || 'expense').toLowerCase().includes('inc') ? 'income' : 'expense',
        amount: Number(r.amount) || 0,
        category: r.category || 'אחר',
        description: r.description || r.category || 'עסקה מיובאת',
        merchant: r.merchant || '',
        date: r.date || todayISO(),
      })).filter((r) => r.amount > 0);
      setPreview(normalized);
      if (!normalized.length) {
        toast({ title: 'לא זוהו עסקאות בקובץ', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'שגיאה בקריאת הקובץ', description: err.message, variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  };

  const save = async () => {
    if (!preview.length) return;
    setSaving(true);
    try {
      const created = await base44.entities.Transaction.bulkCreate(preview);
      for (const t of created) {
        await checkBudgetAlerts(t);
      }
      toast({ title: `${created.length} עסקאות יובאו` });
      reset();
      onDone();
    } catch (err) {
      toast({ title: 'שגיאה בייבוא', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview([]);
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>יבוא עסקאות מ-Excel</DialogTitle>
        </DialogHeader>

        {!file && (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl py-12 cursor-pointer hover:border-primary hover:bg-accent/30 transition-all">
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium">בחרו קובץ Excel או CSV</p>
            <p className="text-xs text-muted-foreground mt-1">עמודות: תאריך, סוג, סכום, קטגוריה, תיאור</p>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>
        )}

        {file && parsing && (
          <div className="flex flex-col items-center py-10">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">קורא ומנתח את הקובץ...</p>
          </div>
        )}

        {file && !parsing && preview.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Check className="w-4 h-4" />
              זוהו {preview.length} עסקאות
            </div>
            <div className="max-h-60 overflow-y-auto scrollbar-thin rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-right px-3 py-2 font-medium">תאריך</th>
                    <th className="text-right px-3 py-2 font-medium">תיאור</th>
                    <th className="text-right px-3 py-2 font-medium">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{r.date}</td>
                      <td className="px-3 py-2">{r.description}</td>
                      <td className={`px-3 py-2 font-semibold ${r.type === 'income' ? 'text-primary' : ''}`}>{r.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {file && !parsing && preview.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-sm">לא הצלחנו לזהות עסקאות בקובץ</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setFile(null)}>בחר קובץ אחר</Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>ביטול</Button>
          {preview.length > 0 && (
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Upload className="w-4 h-4 ml-2" />}
              יבא {preview.length} עסקאות
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}