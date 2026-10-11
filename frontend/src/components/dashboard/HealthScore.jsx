import { Activity, PiggyBank, Target, TrendingUp } from 'lucide-react';
import Card from '../ui/Card';
import { ProgressBar, ProgressRing } from '../ui/Progress';

const FACTOR_ICONS = { savings: PiggyBank, budget: Target, trend: TrendingUp };
const LEVEL_TONE = { excellent: 'success', good: 'success', fair: 'warning', poor: 'danger' };
const LEVEL_TEXT = { success: 'text-brand-600', warning: 'text-warn-600', danger: 'text-danger-500' };

const factorTone = (value) => (value >= 60 ? 'success' : value >= 30 ? 'warning' : 'danger');

/** 0-100 score with the three factors it is built from. */
export default function HealthScore({ health }) {
  const tone = LEVEL_TONE[health.level];
  return (
    <Card title="ניקוד בריאות פיננסית" icon={Activity}>
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <ProgressRing value={health.score} size={132} stroke={13} tone={tone}>
          <span className={`tabular text-[34px] font-extrabold leading-none ${LEVEL_TEXT[tone]}`}>{health.score}</span>
          <span className="mt-1 text-xs text-ink-muted">מתוך 100</span>
        </ProgressRing>

        <ul className="w-full flex-1 space-y-3.5">
          {health.factors.map((factor) => {
            const Icon = FACTOR_ICONS[factor.key];
            return (
              <li key={factor.key}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink-soft">
                    <Icon className="h-4 w-4 text-ink-muted" />
                    {factor.label}
                  </span>
                  <span className="tabular font-semibold">{factor.value}%</span>
                </div>
                <ProgressBar value={factor.value} tone={factorTone(factor.value)} className="h-1.5" />
              </li>
            );
          })}
        </ul>
      </div>
      <p className={`mt-5 border-t border-line pt-4 text-center text-sm font-semibold ${LEVEL_TEXT[tone]}`}>{health.label}</p>
    </Card>
  );
}
