/**
 * Google Gemini client (external API #1).
 * Used for two features: reading receipts (vision) and generating insights (text).
 * The API key never leaves the server.
 */
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
// Free-tier requests can wait in Google's queue for a while; the browser gives up at 90s
const TIMEOUT_MS = 80000;
const BUSY = 'שירות ה-AI עמוס כרגע. נסו שוב בעוד כמה דקות';

const isConfigured = () => Boolean(env.gemini.apiKey);

const parseJson = (text) => {
  const clean = String(text || '').replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

/** Sends `parts` to the model and returns the parsed JSON answer. */
const generateJson = async (parts, { temperature = 0.2 } = {}) => {
  if (!isConfigured()) throw new ApiError(503, 'שירות ה-AI אינו מוגדר בשרת');

  let response;
  try {
    response = await fetch(`${BASE_URL}/${env.gemini.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.gemini.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    logger.error('Gemini request failed:', err.message);
    if (err.name === 'TimeoutError') throw new ApiError(503, BUSY);
    throw new ApiError(502, 'לא ניתן להתחבר לשירות ה-AI. נסו שוב בעוד רגע');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.error(`Gemini responded ${response.status}:`, body.slice(0, 300));
    // Quota reached or the model is overloaded on Google's side - temporary
    if (response.status === 429 || response.status === 503) throw new ApiError(503, BUSY);
    // The model could not read the uploaded document (blank, corrupt or unsupported image)
    if (response.status === 400 && /image|document|input/i.test(body) && !/api key/i.test(body)) {
      throw new ApiError(422, 'לא הצלחנו לקרוא את הקובץ. נסו צילום ברור יותר של הקבלה');
    }
    throw new ApiError(502, 'שירות ה-AI החזיר שגיאה. בדקו את המפתח ואת שם המודל');
  }

  const data = await response.json();
  const text = (data.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  try {
    return parseJson(text);
  } catch {
    logger.error('Gemini returned non-JSON content:', text.slice(0, 300));
    throw new ApiError(502, 'התקבלה תשובה לא תקינה משירות ה-AI');
  }
};

/** Extracts merchant, date and line items from a receipt image or PDF. */
const parseReceipt = (buffer, mimeType, categoryNames = []) => {
  const prompt = `אתה מערכת לקריאת קבלות וחשבוניות בישראל. נתח את המסמך המצורף והחזר JSON בלבד במבנה:
{
  "merchant": "שם בית העסק",
  "date": "YYYY-MM-DD",
  "total": 0,
  "items": [{ "name": "שם המוצר", "quantity": 1, "unitPrice": 0, "total": 0, "category": "קטגוריה" }]
}
כללים:
- כל שורת מוצר בקבלה היא פריט נפרד. אל תאחד מוצרים שונים.
- name: שם מוצר קצר וברור בעברית, בלי קודים ובלי ברקוד.
- unitPrice: מחיר ליחידה אחרי הנחות. total: הסכום ששולם על השורה.
- category: בחר אך ורק מתוך הרשימה: ${categoryNames.join(', ') || 'אחר'}.
- אם שדה לא ניתן לזיהוי, החזר null. מספרים בלבד, ללא סימן מטבע.`;

  return generateJson([{ text: prompt }, { inlineData: { mimeType, data: buffer.toString('base64') } }], {
    temperature: 0.1,
  });
};

/** Turns an aggregated (anonymous) financial summary into short insights in Hebrew. */
const generateInsights = (summary) => {
  const prompt = `אתה יועץ לכלכלת המשפחה. לפניך סיכום נתונים פיננסיים של משק בית (בשקלים):
${JSON.stringify(summary)}

החזר JSON בלבד במבנה: { "insights": [{ "type": "positive" | "warning" | "tip", "title": "כותרת קצרה", "text": "משפט או שניים" }] }
כללים: 3 עד 5 תובנות, בעברית, קונקרטיות ומבוססות אך ורק על המספרים שקיבלת. בלי המלצות השקעה.`;

  return generateJson([{ text: prompt }], { temperature: 0.4 });
};

module.exports = { isConfigured, parseReceipt, generateInsights };
