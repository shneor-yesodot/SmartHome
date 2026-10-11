const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { detectMime } = require('../utils/fileSignature');
const { RECEIPT_MIME_TYPES } = require('../config/constants');

// Files are kept in memory, inspected, and only then written to disk by the manager
const storage = multer.memoryStorage();
const limits = { fileSize: env.maxFileSizeMb * 1024 * 1024, files: 1 };

const receiptUpload = multer({
  storage,
  limits,
  fileFilter: (_req, file, cb) =>
    RECEIPT_MIME_TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(ApiError.badRequest('ניתן להעלות תמונה (JPG, PNG, WEBP) או קובץ PDF בלבד')),
}).single('file');

const sheetUpload = multer({
  storage,
  limits,
  fileFilter: (_req, file, cb) =>
    /\.(xlsx|csv)$/i.test(file.originalname)
      ? cb(null, true)
      : cb(ApiError.badRequest('ניתן להעלות קובץ Excel (‎.xlsx) או CSV בלבד')),
}).single('file');

/** Second line of defence: the file content must match the declared type. */
const requireFile = (kind) => (req, _res, next) => {
  if (!req.file) return next(ApiError.badRequest('לא נבחר קובץ'));

  if (kind === 'receipt') {
    const actual = detectMime(req.file.buffer);
    if (actual !== req.file.mimetype) return next(ApiError.badRequest('תוכן הקובץ אינו תואם לסוג שלו'));
  }
  if (kind === 'sheet' && /\.xlsx$/i.test(req.file.originalname) && detectMime(req.file.buffer) !== 'application/zip') {
    return next(ApiError.badRequest('הקובץ אינו קובץ Excel תקין'));
  }
  next();
};

module.exports = { receiptUpload, sheetUpload, requireFile };
