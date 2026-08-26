export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

export const formatNumber = (amount) => {
  return new Intl.NumberFormat('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('he-IL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const monthName = (date) => {
  return new Date(date).toLocaleDateString('he-IL', { month: 'long' });
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const isSameMonth = (dateStr, ref = new Date()) => {
  const d = new Date(dateStr);
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
};