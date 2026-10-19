export const TYPE_LABELS = { income: 'הכנסה', expense: 'הוצאה' };

export const FREQUENCY_LABELS = { daily: 'יומי', weekly: 'שבועי', monthly: 'חודשי', yearly: 'שנתי' };

export const SOURCE_LABELS = { manual: 'ידני', receipt: 'קבלה', import: 'יבוא Excel', recurring: 'הוראת קבע' };

export const COLORS = ['#12A05C', '#2F7FD1', '#E08A1E', '#D9508A', '#D93F3F', '#7B61D9', '#1FA6A6', '#5C6BC0', '#7C8B83'];

export const CHART_COLORS = { income: '#12A05C', expense: '#E5605F', grid: '#E3EAE5', axis: '#7C8B83' };

export const GOAL_STATUS = {
  completed: { label: 'היעד הושג', tone: 'success' },
  on_track: { label: 'בדרך הנכונה', tone: 'success' },
  behind: { label: 'מפגר מהיעד', tone: 'warning' },
  overdue: { label: 'התאריך עבר', tone: 'danger' },
  at_risk: { label: 'בסיכון החודש', tone: 'warning' },
};

/** "On track" so far, but this month's expenses leave too little for the goal */
export const goalStatus = (progress) =>
  GOAL_STATUS[progress.status === 'on_track' && progress.affordable === false ? 'at_risk' : progress.status];

export const BUDGET_STATUS = {
  ok: { label: 'בתוך התקציב', tone: 'success' },
  warning: { label: 'קרוב לתקרה', tone: 'warning' },
  exceeded: { label: 'חריגה', tone: 'danger' },
};
