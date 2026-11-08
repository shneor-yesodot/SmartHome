/** String helpers. */

/** Escapes user input before it is used inside a RegExp (prevents ReDoS / injection). */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Stable key used to group purchases of the same product across receipts. */
const toProductKey = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/["'`״׳]/g, '')
    .replace(/\s+/g, ' ');

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
