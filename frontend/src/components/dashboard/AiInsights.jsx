import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { EmptyState } from '../ui/States';
import { dashboardService } from '../../services/dashboard.service';
import { useAction } from '../../hooks/useAction';

const TYPES = {
  positive: { icon: CheckCircle2, className: 'bg-brand-50 text-brand-600' },
  warning: { icon: AlertTriangle, className: 'bg-warn-50 text-warn-600' },
  tip: { icon: Lightbulb, className: 'bg-surface text-ink-soft' },
};

/** On-demand insights: Gemini when a key is configured, rule-based otherwise. */
export default function AiInsights() {
  const [result, setResult] = useState(null);
  const { run, pending } = useAction();

  const generate = async () => {
    const { ok, result: data } = await run(dashboardService.insights);
    if (ok) setResult(data);
  };

  return (
    <Card
      title="תובנות AI חכם"
      icon={Sparkles}
      className="flex flex-col"
      bodyClassName="flex-1"
      action={
        <Button variant="secondary" size="sm" icon={Sparkles} loading={pending} onClick={generate}>
          {result ? 'רענון תובנות' : 'קבל תובנות'}
        </Button>
      }
    >
      {!result ? (
        <EmptyState compact icon={Sparkles} title="ניתוח פיננסי חכם" text="ה-AI ינתח את ההוצאות שלכם ויתן המלצות פרקטיות" />
      ) : (
        <>
          <ul className="space-y-2.5">
            {result.insights.map((insight) => {
              const { icon: Icon, className } = TYPES[insight.type] || TYPES.tip;
              return (
                <li key={insight.title} className="flex gap-3">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${className}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <p className="text-[13px] leading-relaxed text-ink-soft">{insight.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-ink-muted">
            {result.source === 'gemini' ? 'נוצר באמצעות Google Gemini' : 'נוצר על ידי מנוע הכללים המובנה (לא הוגדר מפתח Gemini)'}
          </p>
        </>
      )}
    </Card>
  );
}
