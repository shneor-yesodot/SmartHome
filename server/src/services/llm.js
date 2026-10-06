import fs from 'fs';
import path from 'path';
import { ApiError } from '../utils/ApiError.js';

const CATEGORIES = ['מזון', 'תחבורה', 'קניות', 'חשבונות', 'בריאות', 'פנאי', 'מסעדות', 'אחר'];

const RECEIPT_PROMPT = `Analyze this receipt image. Return JSON only, in exactly this shape:
{"merchant": string, "date": "YYYY-MM-DD", "total": number,
 "items": [{"name": string, "price": number, "category": string}]}
Item names should stay in the receipt's language. "category" must be one of: ${CATEGORIES.join(', ')}.
If the date is unreadable, use an empty string.`;

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
 * Sends a locally stored receipt image to the vision model and returns
 * { merchant, date, total, items[] }. The image is inlined as base64 because
 * the model provider cannot reach this server's /uploads URLs.
 */
export async function analyzeReceiptImage(absPath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, 'LLM_UNAVAILABLE', 'סריקת חשבוניות לא מוגדרת בשרת (חסר OPENAI_API_KEY)');
  }
  const mime = MIME[path.extname(absPath).toLowerCase()];
  if (!mime) throw new ApiError(400, 'VALIDATION_ERROR', 'יש להעלות קובץ תמונה');
  const dataUrl = `data:${mime};base64,${fs.readFileSync(absPath).toString('base64')}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: RECEIPT_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error('LLM error', res.status, (await res.text()).slice(0, 500));
    throw new ApiError(502, 'LLM_ERROR', 'ניתוח החשבונית נכשל');
  }

  const data = await res.json();
  try {
    return normalize(JSON.parse(data.choices?.[0]?.message?.content || '{}'));
  } catch {
    throw new ApiError(502, 'LLM_ERROR', 'תשובת ה-AI אינה JSON תקין');
  }
}
