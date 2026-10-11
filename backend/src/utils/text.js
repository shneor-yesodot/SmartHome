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

module.exports = { escapeRegex, toProductKey, cleanText };
