/**
 * The first billing day after a purchase. Real statements close a few days
 * before the charge, so this is an estimate until a statement gives the exact date.
 */
const chargeDateFor = (date, billingDay) => {
  if (!billingDay) return undefined;
  const d = new Date(date);
  const onDay = (year, month) => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(billingDay, lastDay)));
  };
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const thisMonth = onDay(day.getUTCFullYear(), day.getUTCMonth());
  return thisMonth > day ? thisMonth : onDay(day.getUTCFullYear(), day.getUTCMonth() + 1);
};

module.exports = { chargeDateFor };
