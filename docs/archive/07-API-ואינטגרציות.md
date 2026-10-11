
# פרק 7 — ממשקי API ואינטגרציות

## 7.1 סקירת API

השרת חושף REST API תחת התחילית `/api`. כל הבקשות (למעט auth) דורשות כותרת `Authorization: Bearer <token>`.

### אימות (Auth)

| Method | Endpoint | תיאור | גוף בקשה |
|--------|----------|-------|----------|
| POST | `/api/auth/register` | רישום | `{ email, password }` |
| POST | `/api/auth/login` | התחברות | `{ email, password }` |
| POST | `/api/auth/verify-otp` | אימות OTP | `{ email, otpCode }` |
| POST | `/api/auth/forgot-password` | שחזור סיסמה | `{ email }` |
| POST | `/api/auth/reset-password` | איפוס סיסמה | `{ resetToken, newPassword }` |
| GET | `/api/auth/me` | פרטי משתמש | — |
| POST | `/api/auth/logout` | התנתקות | — |

### עסקאות (Transactions)

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/transactions` | רשימת עסקאות (עם פילטרים) |
| POST | `/api/transactions` | יצירת עסקה |
| GET | `/api/transactions/:id` | עסקה בודדת |
| PUT | `/api/transactions/:id` | עדכון עסקה |
| DELETE | `/api/transactions/:id` | מחיקת עסקה |
| POST | `/api/transactions/bulk` | יצירה גורפת |
| GET | `/api/transactions/export` | ייצוא Excel |

**דוגמה — יצירת עסקה:**

```http
POST /api/transactions
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "type": "expense",
  "amount": 12.90,
  "category": "מזון",
  "description": "חלב תנובה 2%",
  "merchant": "שופרסל",
  "date": "2026-08-26"
}
```

**תגובה:**
```json
{
  "status": "success",
  "data": {
    "_id": "65d4a3f2...",
    "type": "expense",
    "amount": 12.90,
    "category": "מזון",
    "created_by_id": "65d4a3f2...",
    "created_date": "2026-08-26T10:30:00Z"
  }
}
```

### קטגוריות, תקציבים, הוראות קבע

CRUD זהה לכל ישות:

| ישות | Endpoints |
|------|-----------|
| Categories | `GET/POST/PUT/DELETE /api/categories` |
| Budgets | `GET/POST/PUT/DELETE /api/budgets` |
| RecurringPayments | `GET/POST/PUT/DELETE /api/recurring` |

### דשבורד ודוחות

| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/dashboard/summary` | סיכום חודשי |
| GET | `/api/dashboard/charts/monthly` | נתוני גרף חודשי |
| GET | `/api/dashboard/charts/categories` | פילוח קטגוריות |
| GET | `/api/reports/monthly/:year/:month` | דוח חודשי |

### העלאת קבצים

| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | `/api/upload/receipt` | העלאת קבלה → ניתוח AI |
| POST | `/api/upload/excel` | העלאת Excel → פירוק עסקאות |

---

## 7.2 אינטגרציות חיצוניות

### 7.2.1 זיהוי קבלות ב-AI (OCR + LLM)

**מטרה:** פירוק תמונת חשבונית לפריטים נפרדים.

**תהליך:**
```
תמונה → UploadFile → InvokeLLM (vision) → JSON { merchant, date, items[] }
```

**פרומפט ל-LLM:**
```
נתח את החשבונית בתמונה. חלץ: שם בית העסק, תאריך, סכום כולל,
ורשימת כל פריטי המוצרים (כל פריט עם שם, מחיר וקטגוריה).
החזר JSON בלבד עם מערך items.
```

**סכמת תגובה:**
```json
{
  "type": "object",
  "properties": {
    "merchant": { "type": "string" },
    "date": { "type": "string" },
    "total": { "type": "number" },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "price": { "type": "number" },
          "category": { "type": "string" }
        }
      }
    }
  }
}
```

### 7.2.2 שליחת מיילים

**מטרה:** התראות חריגת תקציב, אימות רישום, שחזור סיסמה.

**תהליך — התראת חריגה:**
```javascript
await emailService.send({
  to: user.email,
  subject: `התראת חריגת תקציב — ${category}`,
  body: htmlTemplate({ category, budget, spent, overage }),
});
```

**תבנית מייל:**
```html
<div dir="rtl" style="font-family: Heebo, Arial">
  <h2 style="color: #16a34a">התראת חריגת תקציב</h2>
  <p>חרגת מהתקציב לקטגוריה <strong>{category}</strong></p>
  <table>
    <tr><td>תקציב</td><td>{budget} ₪</td></tr>
    <tr><td>הוצאות</td><td>{spent} ₪</td></tr>
    <tr><td>חריגה</td><td style="color:red">{overage} ₪</td></tr>
  </table>
</div>
```

### 7.2.3 יבוא Excel

**תהליך:**
```
קובץ Excel → UploadFile → ExtractDataFromUploadedFile → פירוק לעסקאות → bulkCreate
```

**סכמת חילוץ:**
```json
{
  "type": "object",
  "properties": {
    "transactions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string" },
          "amount": { "type": "number" },
          "category": { "type": "string" },
          "description": { "type": "string" },
          "date": { "type": "string" }
        }
      }
    }
  }
}
```

### 7.2.4 Google OAuth 2.0

```
1. משתמש לוחץ "Continue with Google"
2. הפניה ל-Google Consent Screen
3. Google מחזיר authorization code
4. שרת מחליף code ב-access token
5. שרת מקבל פרטי משתמש מ-Google
6. יצירת/איתור משתמש → JWT → החזרה ללקוח
```

---

## 7.3 קודי תגובה

| קוד | משמעות |
|-----|--------|
| 200 | OK — הצלחה |
| 201 | Created — נוצר בהצלחה |
| 400 | Bad Request — שגיאת ולידציה |
| 401 | Unauthorized — טוקן חסר/פגוע |
| 403 | Forbidden — אין הרשאה (RLS) |
| 404 | Not Found — לא נמצא |
| 429 | Too Many Requests — rate limit |
| 500 | Server Error — שגיאת שרת |

## 7.4 דוגמת תגובת שגיאה

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "סכום חייב להיות חיובי",
    "details": [{ "field": "amount", "message": "must be > 0" }]
  }
}
```

---

## 7.5 תכנית בדיקות

| # | תיאור בדיקה | סוג | תוצאה צפויה |
|---|-------------|-----|-------------|
| T1 | רישום משתמש עם אימייל תקין | Integration | קוד OTP נשלח |
| T2 | רישום עם אימייל קיים | Unit | שגיאה 409 |
| T3 | התחברות עם סיסמה שגויה | Unit | שגיאה 401 |
| T4 | יצירת עסקה ללא טוקן | Unit | שגיאה 401 |
| T5 | קריאת עסקאות של משתמש אחר | Integration | רשימה ריקה (RLS) |
| T6 | העלאת חשבונית עם 3 פריטים | E2E | 3 עסקאות נוצרו |
| T7 | חריגת תקציב → מייל | Integration | מייל נשלח |
| T8 | יבוא Excel עם 10 שורות | E2E | 10 עסקאות נוצרו |
| T9 | ייצוא Excel | Unit | קובץ CSV יורד |
| T10 | עדכון עסקה של אחר | Unit | שגיאה 403 |
| T11 | מחיקת עסקה עצמית | Unit | 204 |
| T12 | דוח חודשי — חישוב חיסכון | Unit | נכון |