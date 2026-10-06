import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { analyzeReceiptImage } from '../services/llm.js';
import { extractTransactionsFromFile, resolveUploadPath, fileExists } from '../services/excel.js';
import { ApiError } from '../utils/ApiError.js';

const ALLOWED_EXT = /\.(xlsx|xls|csv|png|jpe?g|webp|gif)$/i;

export function createUploadRouter(uploadsDir) {
  fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    // Uploads are served statically, so names must be unguessable.
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_EXT.test(file.originalname || '')) {
        return cb(new ApiError(400, 'VALIDATION_ERROR', 'סוג קובץ לא מורשה'));
      }
      cb(null, true);
    },
  });

  function uploadedFile(fileUrl) {
    if (!fileUrl) throw new ApiError(400, 'VALIDATION_ERROR', 'חסר file_url');
    const abs = resolveUploadPath(fileUrl, uploadsDir);
    if (!fileExists(abs)) throw new ApiError(404, 'NOT_FOUND', 'הקובץ לא נמצא');
    return abs;
  }

  const router = express.Router();
  router.use(requireAuth);

  router.post('/', upload.single('file'), (req, res, next) => {
    try {
      if (!req.file) throw new ApiError(400, 'VALIDATION_ERROR', 'חסר קובץ');
      const file_url = `/uploads/${req.file.filename}`;
      res.status(201).json({ status: 'success', data: { file_url, file_name: req.file.originalname } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/analyze-receipt', async (req, res, next) => {
    try {
      const abs = uploadedFile(req.body.file_url);
      const analysis = await analyzeReceiptImage(abs);
      res.json({ status: 'success', data: analysis });
    } catch (err) {
      next(err);
    }
  });

  router.post('/extract-excel', async (req, res, next) => {
    try {
      const abs = uploadedFile(req.body.file_url);
      res.json({ status: 'success', data: extractTransactionsFromFile(abs) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
