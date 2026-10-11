/**
 * Sample receipt returned when GEMINI_API_KEY is not configured, so the full
 * upload flow can still be demonstrated. The UI clearly marks it as demo data.
 */
module.exports = () => ({
  merchant: 'סופר השכונה (הדגמה)',
  date: new Date().toISOString().slice(0, 10),
  items: [
    { name: 'חלב 3% 1 ליטר', quantity: 2, unitPrice: 7.1, total: 14.2, category: 'סופר ומזון' },
    { name: 'לחם אחיד פרוס', quantity: 1, unitPrice: 8.9, total: 8.9, category: 'סופר ומזון' },
    { name: 'ביצים L תבנית 12', quantity: 1, unitPrice: 14.5, total: 14.5, category: 'סופר ומזון' },
    { name: 'קוטג׳ 5% 250 גרם', quantity: 3, unitPrice: 6.3, total: 18.9, category: 'סופר ומזון' },
    { name: 'נוזל כביסה 3 ליטר', quantity: 1, unitPrice: 39.9, total: 39.9, category: 'דיור וחשבונות' },
  ],
});
