# SmartHome — ניהול משק בית חכם

אפליקציה לניהול הוצאות והכנסות של משק בית: עסקאות, תקציבים עם התראות חריגה, הוראות קבע, דוחות, יבוא מ-Excel וסריקת קבלות עם AI.

- **Frontend**: React + Vite + Tailwind (`src/`)
- **Backend**: Node.js + Express + MongoDB (`server/`)

## התקנה

דרישות: Node.js 20+.

```bash
npm run setup          # מתקין תלויות ל-frontend ול-server
cp .env.example .env   # ולערוך לפי הצורך (קובץ .env יחיד, בשורש הפרויקט)
```

## הרצה בפיתוח

```bash
npm run dev
```

הפקודה מריצה את השרת (http://localhost:4000) ואת ה-frontend (http://localhost:5173) יחד. Vite מעביר כל בקשה ל-`/api` ול-`/uploads` לשרת.

אפשר גם להריץ כל צד בנפרד: `npm run dev:server` / `npm run dev:web`.

### MongoDB

השרת מתחבר ל-`MONGODB_URI`. אם אין שרת MongoDB מקומי פועל, בפיתוח השרת מפעיל אוטומטית MongoDB מוטמע (באמצעות `mongodb-memory-server`, בהרצה הראשונה מתבצעת הורדה חד-פעמית של כ-780MB). הנתונים נשמרים ב-`server/.data/db` ונשארים בין הרצות. אפשר להתחבר אליו מ-MongoDB Compass בכתובת `mongodb://127.0.0.1:27017`.

כדי לעבוד מול שרת MongoDB אמיתי (התקנה מקומית או Atlas), מגדירים את `MONGODB_URI` ב-`.env`.

### אימייל

בלי הגדרות SMTP, כל המיילים (כולל קוד האימות בהרשמה) מודפסים לקונסול של השרת. בנוסף, במצב פיתוח תשובת ה-API להרשמה כוללת את השדה `dev_otp`.

### אינטגרציות אופציונליות

| יכולת | משתני סביבה |
|---|---|
| סריקת קבלות (AI) | `GEMINI_API_KEY`, `GEMINI_MODEL` (ברירת מחדל: `gemini-3.8-flash`) |
| התחברות עם Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` |
| שליחת מיילים | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |

### סריקת קבלות עם Gemini

1. מוציאים מפתח API (חינמי) ב-[Google AI Studio](https://aistudio.google.com/apikey).
2. מכניסים אותו ל-`.env` שבשורש הפרויקט:
   ```
   GEMINI_API_KEY=המפתח-שלכם
   ```
3. מפעילים מחדש את השרת.

התמונה נשלחת ל-Gemini מקודדת ב-base64 יחד עם סכמת JSON, וה-AI מחזיר את שם בית העסק, התאריך, הסכום וכל הפריטים עם קטגוריה. בלי מפתח, מסך העלאת הקבלה מציג הודעה שהיכולת לא מוגדרת, וכל שאר האפליקציה עובדת כרגיל.

## Production

```bash
npm run build                    # בונה את ה-frontend ל-dist/
NODE_ENV=production npm start    # השרת מגיש את ה-API ואת dist/ מאותו פורט
```

ב-production חובה להגדיר `MONGODB_URI`, `JWT_SECRET` ו-`JWT_REFRESH_SECRET`, וה-MongoDB המוטמע לא מופעל.

## בדיקות

```bash
npm run lint
npm run build
```
