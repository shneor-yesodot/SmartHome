/**
 * Statement reading, on files built here in the layouts Israeli banks and card
 * companies are known to export. They are stand-ins, not real exports.
 */
const XLSX = require('xlsx');
const { parseStatement, parseAmount, parseDate, isCardSettlement } = require('../src/services/statement.service');

const xlsx = (sheets, bookType = 'xlsx') => {
  const book = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name));
  return XLSX.write(book, { type: 'buffer', bookType });
};

describe('parseAmount', () => {
  it.each([
    ['1,234.50', 1234.5],
    ['₪ 1,234.50', 1234.5],
    ['-50', -50],
    ['50-', -50],
    ['(50)', -50],
    ['‏120.00', 120],
    [99.9, 99.9],
    ['', null],
    ['abc', null],
  ])('%s -> %s', (input, expected) => expect(parseAmount(input)).toBe(expected));
});

describe('parseDate', () => {
  it.each([
    ['05/10/2026', '2026-10-05'],
    ['05/10/26', '2026-10-05'],
    ['5.10.2026', '2026-10-05'],
    ['2026-10-05', '2026-10-05'],
    [46300, '2026-10-05'],
    ['31/02/2026', null],
    ['סה"כ', null],
    ['', null],
  ])('%s -> %s', (input, expected) => expect(parseDate(input)).toBe(expected));
});

describe('isCardSettlement', () => {
  it.each(['ויזה כאל', 'ישראכרט', 'מקס איט פיננסים', 'חיוב כרטיס אשראי', 'לאומי קארד', 'כאל'])('%s is a card charge', (text) =>
    expect(isCardSettlement(text)).toBe(true)
  );
  it.each(['העברה למיכאל', 'מקסים פיצה', 'שופרסל דיל', 'קלאסיקה'])('%s is not', (text) => expect(isCardSettlement(text)).toBe(false));
});

describe('a bank statement', () => {
  const file = xlsx({
    תנועות: [
      ['בנק לדוגמה - תנועות בחשבון'],
      ['חשבון 12-345-678901'],
      [],
      ['תאריך', 'תאריך ערך', 'תיאור', 'אסמכתא', 'חובה', 'זכות', 'יתרה'],
      ['01/10/2026', '01/10/2026', 'משכורת', '111', '', '12,000.00', '15,000.00'],
      ['02/10/2026', '02/10/2026', 'הוראת קבע ועד בית', '222', '250.00', '', '14,750.00'],
      ['10/10/2026', '10/10/2026', 'ויזה כאל', '333', '3,400.50', '', '11,349.50'],
      ['סה"כ', '', '', '', '3,650.50', '12,000.00', ''],
    ],
  });

  const rows = parseStatement(file);

  it('finds the table below the title rows and skips the totals', () => expect(rows).toHaveLength(3));

  it('reads debit and credit columns', () => {
    expect(rows[0]).toMatchObject({ date: '2026-10-01', type: 'income', amount: 12000, kind: 'bank', isRefund: false });
    expect(rows[1]).toMatchObject({ type: 'expense', amount: 250, standing: true });
  });

  it('flags the lump sum a credit card takes from the account', () => {
    expect(rows[2]).toMatchObject({ settlement: true, amount: 3400.5 });
    expect(rows[1].settlement).toBe(false);
  });
});

describe('a bank export with one signed column and a table of planned lines', () => {
  const rows = parseStatement(
    xlsx({
      'עובר ושב': [
        ['עובר ושב'],
        ['תנועות אחרונות'],
        ['תאריך', 'יום ערך', 'תיאור התנועה', '₪ זכות/חובה ', '₪ יתרה ', 'אסמכתה', 'עמלה', 'ערוץ ביצוע'],
        [46321, 46321, "מש' מכספומט דיסקונט 26/10", -200, 5000, '1/2', '', ''],
        [46320, 46320, 'כספומט בנק לאומי לי 25/10 06:54', -500, 5200, '3/4', '', ''],
        [46319, 46319, 'חיוב לכרטיס ויזה 1111', -900, 5700, '5', '', ''],
        [46318, 46318, 'זיכוי לכרטיס ויזה 1111', 30, 6600, '6', '', ''],
        [46317, 46317, 'כ.א.ל חיוב', -54, 6570, '7', '', ''],
        [46316, 46316, 'זיכוי הנחות מפתח מכרטיס 1111', 1, 6624, '8', '', ''],
        [46315, 46315, 'מי העיר חיוב', -143.78, 6623, '9', '', ''],
        [46314, 46314, 'העברה לפלוני אלמוני', -160, 6766.78, '10', '', ''],
        [46313, 46313, 'משרד החינוך משכורת', 8000, 6926.78, '11', '', ''],
        ['תנועות עתידיות'],
        ['תאריך', '', 'תיאור התנועה', '₪ זכות/חובה ב '],
        [46330, '', 'חיוב לכרטיס ויזה 1111', -1500],
      ],
    })
  );
  const line = (text) => rows.find((r) => r.description.startsWith(text));

  it('reads the signed column and stops before the planned lines', () => {
    expect(rows).toHaveLength(9);
    expect(line('משרד החינוך')).toMatchObject({ date: '2026-10-18', type: 'income', amount: 8000, kind: 'bank' });
    expect(line('העברה')).toMatchObject({ type: 'expense', amount: 160, settlement: false, cashWithdrawal: false, standing: false });
  });

  it('flags what a card charges or returns, in both directions', () => {
    expect(line('חיוב לכרטיס')).toMatchObject({ settlement: true, type: 'expense', standing: false });
    expect(line('זיכוי לכרטיס')).toMatchObject({ settlement: true, type: 'income' });
    expect(line('כ.א.ל')).toMatchObject({ settlement: true });
    expect(line('זיכוי הנחות').settlement).toBe(false);
  });

  it('flags cash withdrawals', () => {
    expect(line('מש׳'.replace('׳', "'"))).toMatchObject({ cashWithdrawal: true, amount: 200 });
    expect(line('כספומט')).toMatchObject({ cashWithdrawal: true, amount: 500 });
  });

  it('recognizes a direct debit as a standing order', () => expect(line('מי העיר')).toMatchObject({ standing: true, amount: 143.78 }));
});

describe('a card line marked as a standing order only in its details', () => {
  it('is a standing order', () => {
    const [row] = parseStatement(
      xlsx({ a: [['כרטיס', 'בית עסק', 'תאריך עסקה', 'סכום העסקה', 'סוג העסקה', 'פירוט', 'תאריך החיוב', 'סכום החיוב'], ['ויזה 1111', 'חברת ביטוח', '01/10/2026', '₪50.00', 'רגיל-ישראל', 'הוראת קבע', '11/10/2026', '₪50.00']] })
    );
    expect(row).toMatchObject({ standing: true, last4: '1111', amount: 50, kind: 'credit' });
  });
});

describe('a credit card statement', () => {
  const rows = parseStatement(
    xlsx({
      'עסקאות בארץ': [
        ['פירוט חיובים לכרטיס'],
        ['תאריך עסקה', 'שם בית העסק', 'קטגוריה', '4 ספרות אחרונות של כרטיס האשראי', 'סוג עסקה', 'סכום חיוב', 'מטבע חיוב', 'סכום עסקה מקורי', 'מטבע עסקה מקורי', 'תאריך חיוב', 'הערות'],
        ['03/10/2026', 'שופרסל דיל', 'מזון', '1234', 'רגילה', 350.2, '₪', 350.2, '₪', '10/11/2026', ''],
        ['04/09/2026', 'רהיטים בע"מ', 'ריהוט', '1234', 'תשלומים', 500, '₪', 3000, '₪', '10/11/2026', 'תשלום 2 מתוך 6'],
        ['05/10/2026', 'שופרסל דיל', 'מזון', '1234', 'זיכוי', -40, '₪', -40, '₪', '10/11/2026', ''],
      ],
      'עסקאות בחו"ל': [
        ['תאריך עסקה', 'שם בית העסק', '4 ספרות אחרונות של כרטיס האשראי', 'סכום חיוב', 'סכום עסקה מקורי', 'מטבע עסקה מקורי', 'תאריך חיוב'],
        ['06/10/2026', 'AMAZON', '5678', 185.4, 50, 'USD', '10/11/2026'],
      ],
    })
  );

  it('reads every sheet', () => expect(rows).toHaveLength(4));

  it('takes the charged amount, the card and the charge date', () => {
    expect(rows[0]).toMatchObject({ amount: 350.2, type: 'expense', kind: 'credit', last4: '1234', chargeDate: '2026-11-10', settlement: false });
  });

  it('charges one installment, not the whole purchase, and notes it', () => {
    expect(rows[1].amount).toBe(500);
    expect(rows[1].notes).toContain('תשלום 2 מתוך 6');
  });

  it('books an installment in the month it is paid and remembers the purchase day', () => {
    expect(rows[1]).toMatchObject({ date: '2026-11-10', chargeDate: '2026-11-10' });
    expect(rows[1].notes).toContain('נרכש ב-04/09/2026');
    expect(rows[0].date).toBe('2026-10-03');
  });

  it('marks money back as a refund, not earnings', () => expect(rows[2]).toMatchObject({ type: 'income', amount: 40, isRefund: true }));

  it('keeps the foreign amount as a note', () => {
    expect(rows[3]).toMatchObject({ amount: 185.4, last4: '5678' });
    expect(rows[3].notes).toContain('50 USD');
  });
});

describe('other file shapes', () => {
  it('reads an old .xls', () => {
    const rows = parseStatement(xlsx({ a: [['תאריך', 'תיאור', 'חובה', 'זכות'], ['01/10/2026', 'קניה', '10', '']] }, 'biff8'));
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(10);
  });

  it('reads an HTML table saved as .xls, keeping day-first dates', () => {
    const html = '<html><body><table><tr><td>תאריך</td><td>תיאור</td><td>חובה</td><td>זכות</td></tr><tr><td>03/10/2026</td><td>קניה</td><td>1,020.50</td><td></td></tr></table></body></html>';
    const [row] = parseStatement(Buffer.from(html));
    expect(row).toMatchObject({ date: '2026-10-03', amount: 1020.5 });
  });

  it('reads a CSV in the Hebrew Windows encoding', () => {
    // "תאריך,תיאור,סכום" and one line, in windows-1255 bytes
    const hebrew = (text) => Buffer.from([...text].map((c) => (c >= 'א' && c <= 'ת' ? c.charCodeAt(0) - 0x5d0 + 0xe0 : c.charCodeAt(0))));
    const [row] = parseStatement(hebrew('תאריך,תיאור,סכום\n03/10/2026,קניה,-70.5\n'));
    expect(row).toMatchObject({ date: '2026-10-03', description: 'קניה', amount: 70.5, type: 'expense' });
  });

  it('refuses a file with no table of transactions', () => {
    expect(() => parseStatement(xlsx({ a: [['שם', 'גיל'], ['דנה', 30]] }))).toThrow();
  });
});

describe('fingerprints', () => {
  const file = xlsx({ a: [['תאריך', 'תיאור', 'חובה', 'זכות'], ['01/10/2026', 'קפה', '12', ''], ['01/10/2026', 'קפה', '12', ''], ['02/10/2026', 'קפה', '12', '']] });

  it('tells two real identical purchases apart', () => {
    const hashes = parseStatement(file).map((r) => r.importHash);
    expect(new Set(hashes).size).toBe(3);
  });

  it('gives the same file the same fingerprints', () => {
    expect(parseStatement(file).map((r) => r.importHash)).toEqual(parseStatement(file).map((r) => r.importHash));
  });
});
