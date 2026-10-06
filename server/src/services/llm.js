import fs from 'fs';
import path from 'path';
import { ApiError } from '../utils/ApiError.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const CATEGORIES = ['מזון', 'תחבורה', 'קניות', 'חשבונות', 'בריאות', 'פנאי', 'מסעדות', 'אחר'];

const RECEIPT_PROMPT = `Analyze this receipt image and extract the merchant name, the purchase date
(YYYY-MM-DD, or an empty string if unreadable), the total, and every line item with its price.
Keep item names in the receipt's language. Assign each item one of these categories: ${CATEGORIES.join(', ')}.`;

// Gemini structured output: the model must answer with JSON matching this schema.
const RECEIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    merchant: { type: 'STRING' },
    date: { type: 'STRING' },
    total: { type: 'NUMBER' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          price: { type: 'NUMBER' },
          category: { type: 'STRING', enum: CATEGORIES },
        },
        required: ['name', 'price', 'category'],
      },
    },
  },
  required: ['merchant', 'date', 'total', 'items'],
};

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

function normalize(raw) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw.date || '') ? raw.date : '';
  const items = (Array.isArray(raw.items) ? raw.items : []).map((it) => ({
    name: String(it.name || ''),
    price: Number(it.price) || 0,
    category: CATEGORIES.includes(it.category) ? it.category : 'אחר',
  }));
  return { merchant: String(raw.merchant || ''), date, total: Number(raw.total) || 0, items };
}

/**
 * Sends a locally stored receipt image to Gemini and returns
 * { merchant, date, total, items[] }. The image is inlined as base64 because
 * the model provider cannot reach this server's /uploads URLs.
 */
export async function analyzeReceiptImage(absPath) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, 'LLM_UNAVAILABLE', 'סריקת חשבוניות לא מוגדרת בשרת (חסר GEMINI_API_KEY)');
  }
  const mime = MIME[path.extname(absPath).toLowerCase()];
  if (!mime) throw new ApiError(400, 'VALIDATION_ERROR', 'יש להעלות קובץ תמונה');

  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const res = await fetch(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: RECEIPT_PROMPT },
            { inline_data: { mime_type: mime, data: fs.readFileSync(absPath).toString('base64') } },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        response_schema: RECEIPT_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    console.error('Gemini error', res.status, (await res.text()).slice(0, 500));
    throw new ApiError(502, 'LLM_ERROR', 'ניתוח החשבונית נכשל');
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  try {
    return normalize(JSON.parse(text || '{}'));
  } catch {
    throw new ApiError(502, 'LLM_ERROR', 'תשובת ה-AI אינה JSON תקין');
  }
}
