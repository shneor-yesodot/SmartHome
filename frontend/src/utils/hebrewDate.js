/** Hebrew-calendar date with Hebrew numerals, e.g. "ז׳ בחשוון תשפ״ז". Built on Intl - no library. */

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

/** 1-999 in Hebrew letters with geresh / gershayim (15 and 16 are written ט״ו / ט״ז). */
export const toHebrewNumeral = (n) => {
  let letters = HUNDREDS[Math.floor(n / 100)];
  const rest = n % 100;
  if (rest === 15) letters += 'טו';
  else if (rest === 16) letters += 'טז';
  else letters += TENS[Math.floor(rest / 10)] + ONES[rest % 10];
  return letters.length === 1 ? `${letters}׳` : `${letters.slice(0, -1)}״${letters.slice(-1)}`;
};

const hebrewParts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' });

export const formatHebrewDate = (date) => {
  const parts = Object.fromEntries(hebrewParts.formatToParts(date).map((p) => [p.type, p.value]));
  return `${toHebrewNumeral(Number(parts.day))} ב${parts.month} ${toHebrewNumeral(Number(parts.year) % 1000)}`;
};
