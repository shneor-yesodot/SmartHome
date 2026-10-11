/** Excel export / import built on ExcelJS. */
const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { cleanText } = require('../utils/text');

const TYPE_LABELS = { income: 'הכנסה', expense: 'הוצאה' };
const BRAND = 'FF12A05C';

const COLUMNS = [
  { header: 'תאריך', key: 'date', width: 14 },
  { header: 'סוג', key: 'type', width: 10 },
  { header: 'סכום', key: 'amount', width: 12 },
  { header: 'קטגוריה', key: 'category', width: 18 },
  { header: 'תיאור', key: 'description', width: 30 },
  { header: 'בית עסק', key: 'merchant', width: 20 },
  { header: 'מוצר', key: 'product', width: 24 },
  { header: 'כמות', key: 'quantity', width: 8 },
];

// Accepted header names (Hebrew + English) for each field when importing
const HEADER_ALIASES = {
  date: ['תאריך', 'date'],
  type: ['סוג', 'type'],
  amount: ['סכום', 'amount', 'sum'],
  category: ['קטגוריה', 'category'],
  description: ['תיאור', 'description', 'פירוט'],
  merchant: ['בית עסק', 'merchant', 'עסק'],
  product: ['מוצר', 'product', 'שם מוצר'],
  quantity: ['כמות', 'quantity', 'qty'],
};

const createSheet = (workbook, name) => {
  const sheet = workbook.addWorksheet(name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  sheet.columns = COLUMNS;
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
  header.alignment = { horizontal: 'center' };
  sheet.getColumn('date').numFmt = 'dd/mm/yyyy';
  sheet.getColumn('amount').numFmt = '#,##0.00';
  return sheet;
};

/** Builds an .xlsx file (Buffer) from populated transactions. */
const buildTransactionsWorkbook = async (transactions) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartHome';
  const sheet = createSheet(workbook, 'עסקאות');

  transactions.forEach((t) =>
    sheet.addRow({
      date: t.date,
      type: TYPE_LABELS[t.type],
      amount: t.amount,
      category: t.category?.name || '',
      description: t.description,
      merchant: t.merchant || '',
      product: t.productName || '',
      quantity: t.productName ? t.quantity : '',
    })
  );
  sheet.autoFilter = { from: 'A1', to: 'H1' };
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

/** Empty file with the expected columns and one example row. */
const buildTemplateWorkbook = async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = createSheet(workbook, 'עסקאות');
  sheet.addRow({ date: new Date(), type: 'הוצאה', amount: 249.9, category: 'סופר ומזון', description: 'קנייה שבועית', merchant: 'שופרסל', product: '', quantity: '' });
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

const cellValue = (cell) => {
  const v = cell?.value;
  if (v && typeof v === 'object' && !(v instanceof Date)) return v.result ?? v.text ?? v.richText?.map((r) => r.text).join('') ?? '';
  return v ?? '';
};

const parseDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const text = cleanText(value);
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/); // dd/mm/yyyy
  if (m) return new Date(Date.UTC(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]));
  return null;
};

/** Explicit type from the sheet, or null when the cell is empty / unknown. */
const parseType = (value) => {
  const text = cleanText(value).toLowerCase();
  if (['הכנסה', 'income', 'זכות'].includes(text)) return 'income';
  if (['הוצאה', 'expense', 'חובה'].includes(text)) return 'expense';
  return null;
};

/**
 * Reads the first sheet of an uploaded .xlsx / .csv file.
 * Returns normalised rows; invalid rows carry an `error` message instead of being dropped.
 */
const parseTransactionsFile = async (buffer, { isCsv = false } = {}) => {
  const workbook = new ExcelJS.Workbook();
  let sheet;
  if (isCsv) sheet = await workbook.csv.read(Readable.from(buffer));
  else {
    await workbook.xlsx.load(buffer);
    sheet = workbook.worksheets[0];
  }
  if (!sheet || sheet.rowCount < 2) return [];

  // Map column index -> field by reading the header row
  const columnOf = {};
  sheet.getRow(1).eachCell((cell, col) => {
    const header = cleanText(cellValue(cell)).toLowerCase();
    const field = Object.keys(HEADER_ALIASES).find((key) => HEADER_ALIASES[key].includes(header));
    if (field && !columnOf[field]) columnOf[field] = col;
  });

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (field) => (columnOf[field] ? cellValue(row.getCell(columnOf[field])) : '');

    const rawAmount = Number(String(get('amount')).replace(/[₪,\s]/g, ''));
    const date = parseDate(get('date'));
    const product = cleanText(get('product'));
    const description = cleanText(get('description')) || product || cleanText(get('merchant'));
    if (!description && !rawAmount && !date) return; // skip empty lines

    const errors = [];
    if (!date) errors.push('תאריך לא תקין');
    if (!Number.isFinite(rawAmount) || rawAmount === 0) errors.push('סכום לא תקין');
    if (!description) errors.push('חסר תיאור');

    rows.push({
      row: rowNumber,
      date: date ? date.toISOString().slice(0, 10) : null,
      type: parseType(get('type')),
      signed: rawAmount,
      amount: Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0,
      categoryName: cleanText(get('category')),
      description: description.slice(0, 140),
      merchant: cleanText(get('merchant')).slice(0, 80),
      productName: product.slice(0, 120),
      quantity: Number(get('quantity')) > 0 ? Number(get('quantity')) : 1,
      error: errors.join(', ') || null,
    });
  });

  // Rows without an explicit type: if the file uses negative numbers (bank export style)
  // the sign decides, otherwise every row is treated as an expense.
  const usesSigns = rows.some((r) => r.signed < 0);
  return rows.map(({ signed, ...r }) => ({
    ...r,
    type: r.type || (usesSigns && signed > 0 ? 'income' : 'expense'),
  }));
};

module.exports = { buildTransactionsWorkbook, buildTemplateWorkbook, parseTransactionsFile };
