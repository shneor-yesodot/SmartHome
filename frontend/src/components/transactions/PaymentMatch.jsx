import { useEffect, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { transactionService } from '../../services/transaction.service';
import { formatDate, formatMoney } from '../../utils/format';

const round2 = (n) => Math.round(n * 100) / 100;

const diffText = (diff) => {
  if (diff === 0) return 'אותו סכום בדיוק';
  if (diff > 0) return `החיוב גבוה ב-${formatMoney(diff)}: ההפרש יירשם כפריט נוסף`;
  return `החיוב נמוך ב-${formatMoney(-diff)} (למשל הנחה): ההפרש יירד מהפריט היקר`;
};

/**
 * A purchase being saved may already be on an imported card or bank statement.
 * Then its items replace that line, so the money counts once. An exact amount is
 * chosen for the user; a close one only when they choose it.
 */
export default function PaymentMatch({ date, total, merchant, value, onChange }) {
  const [candidates, setCandidates] = useState([]);
  const amount = round2(Number(total) || 0);

  useEffect(() => {
    if (!date || amount <= 0) {
      setCandidates([]);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(() => {
      transactionService
        .paymentCandidates({ date, total: amount, merchant })
        .then((list) => active && setCandidates(list))
        .catch(() => active && setCandidates([]));
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [date, amount, merchant]);

  // A new list: keep the choice when it is still there. An exact match is taken only until
  // the user chooses for themselves, "don't link" included.
  const chosenByUser = useRef(false);
  useEffect(() => {
    if (candidates.some((c) => c.id === value)) return;
    if (chosenByUser.current && !value) return;
    const exact = !chosenByUser.current && candidates.find((c) => c.diff === 0);
    onChange(exact ? exact.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates]);
  const choose = (id) => {
    chosenByUser.current = true;
    onChange(id);
  };

  if (!candidates.length) return null;

  return (
    <fieldset className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/60 p-3.5">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-brand-700">
        <Link2 className="h-4 w-4" />
        הקנייה כבר מופיעה בדף שיובא?
      </legend>
      <p className="text-xs text-ink-soft">אם כן, הפריטים יחליפו את שורת החיוב, וההוצאה תיספר פעם אחת.</p>
      {candidates.map((c) => (
        <label key={c.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-white px-3 py-2 text-sm">
          <input type="radio" name="payment" className="mt-1 h-4 w-4 accent-brand-500" checked={value === c.id} onChange={() => choose(c.id)} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="truncate font-medium">{c.description}</span>
              <b className="tabular">{formatMoney(c.amount)}</b>
            </span>
            <span className="tabular block text-xs text-ink-muted">
              {formatDate(c.date)}
              {c.account && ` · ${c.account.name}`}
              {c.chargeDate && ` · חיוב ${formatDate(c.chargeDate)}`}
            </span>
            <span className={`block text-xs ${c.diff === 0 ? 'text-brand-600' : 'text-warn-600'}`}>{diffText(c.diff)}</span>
          </span>
        </label>
      ))}
      <label className="flex cursor-pointer items-start gap-2.5 px-3 py-1 text-sm">
        <input type="radio" name="payment" className="mt-1 h-4 w-4 accent-brand-500" checked={!value} onChange={() => choose(null)} />
        <span>
          זו קנייה אחרת, לשמור בלי לקשר
          <span className="block text-xs text-ink-muted">אם זה בכל זאת אותו חיוב, ההוצאה תיספר פעמיים</span>
        </span>
      </label>
    </fieldset>
  );
}
