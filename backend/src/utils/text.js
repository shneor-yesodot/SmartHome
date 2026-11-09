/** String helpers. */

/** Escapes user input before it is used inside a RegExp (prevents ReDoS / injection). */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Spellings of the same unit, after quotes are removed ("ק״ג" -> "קג")
const UNITS = new Map(
  Object.entries({
    ל: ['ל', 'ליטר', 'ליטרים', 'lt', 'l', 'liter'],
    מל: ['מל', 'מיליליטר', 'ml'],
    קג: ['קג', 'קילו', 'קילוגרם', 'kg'],
    ג: ['ג', 'גר', 'גרם', 'גרמים', 'g', 'gr'],
    יח: ['יח', 'יחידה', 'יחידות'],
  }).flatMap(([unit, spellings]) => spellings.map((s) => [s, unit]))
);
const NUMBER = /^\d+(\.\d+)?$/;

/**
 * Stable key used to group purchases of the same product across receipts.
 * Word order and unit spelling do not matter: "חלב תנובה 2 ליטר" and "2 ל׳ חלב תנובה" share a key.
 */
const toProductKey = (name) => {
  const words = String(name || '')
    .toLowerCase()
    .replace(/["'`״׳]/g, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^\p{L}\d.%]+/gu, ' ')
    .replace(/(\d)(\p{L})/gu, '$1 $2')
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .split(' ')
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
  const tokens = [];
  for (let i = 0; i < words.length; i += 1) {
    const unit = UNITS.get(words[i + 1]);
    if (NUMBER.test(words[i]) && unit) {
      tokens.push(`${Number(words[i])}${unit}`); // "2 ליטר" -> "2ל"
      i += 1;
    } else tokens.push(NUMBER.test(words[i]) ? String(Number(words[i])) : words[i]);
  }
  return tokens.sort().join(' ');
};

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const merchantWords = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

/**
 * Whether two names probably mean the same store. Statements and receipts spell it
 * differently ("שופרסל דיל 123" against "שופרסל"), so one shared word is enough.
 */
const sameMerchant = (a, b) => {
  const words = new Set(merchantWords(a));
  return merchantWords(b).some((w) => words.has(w));
};

module.exports = { escapeRegex, toProductKey, cleanText, sameMerchant };
