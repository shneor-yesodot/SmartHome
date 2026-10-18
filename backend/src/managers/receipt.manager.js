const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const env = require('../config/env');
const receiptRepository = require('../repositories/receipt.repository');
const categoryRepository = require('../repositories/category.repository');
const categoryManager = require('./category.manager');
const transactionManager = require('./transaction.manager');
const geminiService = require('../services/gemini.service');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/finance');
const { cleanText } = require('../utils/text');
const demoReceipt = require('../seed/demoReceipt');

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };
const receiptsDir = () => path.resolve(env.uploadDir, 'receipts');

/** Stores the file under a random name - the original file name is never used on disk. */
const saveFile = async (file) => {
  await fs.mkdir(receiptsDir(), { recursive: true });
  const fileName = `${crypto.randomUUID()}${EXTENSIONS[file.mimetype]}`;
  await fs.writeFile(path.join(receiptsDir(), fileName), file.buffer);
  return fileName;
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Cleans the AI answer and links every line to one of the user's categories. */
const normalizeItems = (rawItems, categories, fallback) =>
  (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => {
      const quantity = toNumber(item.quantity, 1) || 1;
      const total = round2(toNumber(item.total) || toNumber(item.unitPrice) * quantity);
      const unitPrice = round2(toNumber(item.unitPrice) || total / quantity);
      const category = categories.find((c) => c.name === cleanText(item.category)) || fallback;
      return { name: cleanText(item.name).slice(0, 120), quantity, unitPrice, total, category: category._id };
    })
    .filter((item) => item.name && item.total > 0);

/**
 * Step 1 - upload a receipt and let the AI break it into product lines.
 * Nothing is added to the books yet; the user reviews the lines first.
 */
const scan = async (userId, file) => {
  const categories = await categoryRepository.findAllByUser(userId, { type: 'expense' });
  const fallback = await categoryManager.getFallback(userId, 'expense');

  const useAi = geminiService.isConfigured();
  const parsed = useAi
    ? await geminiService.parseReceipt(file.buffer, file.mimetype, categories.map((c) => c.name))
    : demoReceipt();

  const items = normalizeItems(parsed.items, categories, fallback);
  if (!items.length) throw new ApiError(422, 'לא זוהו מוצרים בקבלה. נסו לצלם שוב בתאורה טובה ובלי קיפולים');

  const purchaseDate = new Date(parsed.date);
  const receipt = await receiptRepository.create(userId, {
    originalName: cleanText(file.originalname).slice(0, 120),
    fileName: await saveFile(file),
    mimeType: file.mimetype,
    size: file.size,
    merchant: cleanText(parsed.merchant).slice(0, 80),
    purchaseDate: Number.isNaN(purchaseDate.getTime()) ? new Date() : purchaseDate,
    total: round2(items.reduce((s, i) => s + i.total, 0)),
    items,
    engine: useAi ? 'gemini' : 'demo',
  });
  return receipt;
};

/** Step 2 - the reviewed lines become transactions, one per product. */
const confirm = async (userId, id, { merchant, date, items }) => {
  const receipt = await receiptRepository.findOneByUser(userId, id);
  if (!receipt) throw ApiError.notFound('הקבלה לא נמצאה');
  if (receipt.status === 'confirmed') throw ApiError.conflict('הקבלה הזו כבר נשמרה כעסקאות');

  const rows = transactionManager.itemsToRows({ merchant, date, items });
  const transactions = await transactionManager.bulkCreate(userId, rows, {
    source: 'receipt',
    extra: { receipt: receipt._id },
  });

  receipt.set({
    merchant,
    purchaseDate: date,
    items: items.map((item) => ({ ...item, unitPrice: round2(item.total / item.quantity) })),
    total: round2(items.reduce((s, i) => s + i.total, 0)),
    status: 'confirmed',
    transactionsCount: transactions.length,
  });
  await receipt.save();
  return { receipt, created: transactions.length };
};

/** Newest first, with the category of every product line. */
const list = async (userId, { page = 1, limit = 20 } = {}) => {
  const [items, total] = await Promise.all([
    receiptRepository.findAllByUser(userId, {}, {
      sort: { createdAt: -1 },
      skip: (page - 1) * limit,
      limit,
      populate: { path: 'items.category', select: 'name icon color' },
    }),
    receiptRepository.countByUser(userId),
  ]);
  return { items, pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) } };
};

const remove = async (userId, id) => {
  const receipt = await receiptRepository.deleteByUser(userId, id);
  if (!receipt) throw ApiError.notFound('הקבלה לא נמצאה');
  await fs.unlink(path.join(receiptsDir(), receipt.fileName)).catch(() => {});
};

/** Absolute path of the stored file, after verifying ownership. */
const getFile = async (userId, id) => {
  const receipt = await receiptRepository.findOneByUser(userId, id);
  if (!receipt) throw ApiError.notFound('הקבלה לא נמצאה');
  return { path: path.join(receiptsDir(), receipt.fileName), mimeType: receipt.mimeType };
};

module.exports = { scan, confirm, list, remove, getFile };
