# SmartHome – תיעוד ה‑API

כתובת בסיס: `/api` · פורמט: JSON · אימות: `Authorization: Bearer <JWT>`

כל תשובה מוצלחת עטופה במבנה אחיד:

```json
{ "success": true, "data": { }, "meta": { } }
```

כל שגיאה מוחזרת כך (ההודעה בעברית ומוצגת למשתמש כמות שהיא):

```json
{ "success": false, "message": "השדה \"סכום\" חייב להיות מספר חיובי", "details": [{ "field": "amount", "message": "..." }] }
```

| קוד | משמעות |
|---|---|
| 200 / 201 / 204 | הצלחה / נוצר / נמחק (ללא תוכן) |
| 400 | קלט לא תקין (ולידציה) |
| 401 | לא מחובר או שפג תוקף ה‑token |
| 403 | אין הרשאה |
| 404 | לא נמצא (כולל משאב של משתמש אחר) |
| 409 | התנגשות (כפילות, קטגוריה בשימוש) |
| 422 | לא זוהו מוצרים בקבלה / לא ניתן לקרוא את הקובץ |
| 429 | חריגה ממגבלת קצב הבקשות |
| 502 / 503 | שירות ה‑AI החיצוני לא זמין, עמוס או לא מוגדר |

## אימות – `/api/auth`

**סשן** = `{ user, token, refreshToken }`. ה‑`token` (access, ברירת מחדל 15 דקות) נשלח בכל בקשה. ה‑`refreshToken` (ברירת מחדל 7 ימים) משמש רק לקבלת זוג חדש:

- כל רענון מחליף את ה‑refresh token (rotation).
- שימוש חוזר ב‑token שכבר הוחלף נחשב גניבה ומבטל את כל הסשנים של המשתמש. יוצא מן הכלל: חלון של 30 שניות, בשביל שתי לשוניות שמרעננות יחד.

**אימות מייל** פעיל רק כשמוגדר SMTP. במקרה כזה הרשמה והתחברות של חשבון לא מאומת מחזירות `{ verificationRequired: true, email }` במקום סשן.

| שיטה | נתיב | תיאור | גוף הבקשה |
|---|---|---|---|
| GET | `/auth/config` | מה זמין בשרת: `{ google, emailVerification }` | – |
| POST | `/auth/register` | הרשמה ויצירת קטגוריות ברירת מחדל. מחזיר סשן או `verificationRequired` | `name, email, password` |
| POST | `/auth/login` | התחברות. מחזיר סשן או `verificationRequired` | `email, password` |
| POST | `/auth/verify-email` | אימות הקוד (6 ספרות, 10 דקות, עד 5 ניסיונות). מחזיר סשן | `email, code` |
| POST | `/auth/resend-code` | שליחת קוד חדש. התשובה זהה בכל מקרה | `email` |
| POST | `/auth/forgot-password` | שליחת קישור איפוס (תקף שעה). התשובה זהה בכל מקרה | `email` |
| POST | `/auth/reset-password` | סיסמה חדשה: מבטל את כל הסשנים ומחזיר סשן חדש | `token, password` |
| POST | `/auth/refresh` | זוג טוקנים חדש | `refreshToken` |
| POST | `/auth/logout` | ביטול ה‑refresh token | `refreshToken` |
| GET | `/auth/google` | הפניה להתחברות עם Google (`?returnTo=/path`) | – |
| GET | `/auth/google/callback` | חזרה מ‑Google. הטוקנים חוזרים ב‑fragment אל `/oauth-callback` | – |
| GET | `/auth/me` 🔒 | המשתמש המחובר | – |
| PATCH | `/auth/me` 🔒 | עדכון שם והעדפות התראה | `name?, notifications?` |
| PUT | `/auth/password` 🔒 | החלפת סיסמה: מבטל את שאר הסשנים ומחזיר סשן חדש | `currentPassword, newPassword` |

🔒 = דורש התחברות. כל הנתיבים שמכאן והלאה דורשים התחברות.

## דשבורד – `/api/dashboard`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/dashboard` | כל נתוני הדשבורד בבקשה אחת: סיכום, ניקוד בריאות, תחזית, 6 חודשים, פילוח קטגוריות, לוח יומי, תקציבים, יעדים ו‑`savingsPlan` (כמו `meta.month` ביעדים), עסקאות אחרונות |
| POST | `/dashboard/insights` | תובנות (Gemini, או מנוע כללים כשאין מפתח) |

## עסקאות – `/api/transactions`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/transactions` | רשימה עם סינון ודפדוף. פרמטרים: `page, limit, type, category, source, from, to, search` |
| POST | `/transactions` | יצירה: `type, amount, category, description, date, merchant?, notes?, productName?, quantity?` |
| GET | `/transactions/:id` | עסקה בודדת |
| PUT | `/transactions/:id` | עדכון |
| DELETE | `/transactions/:id` | מחיקה |
| GET | `/transactions/export` | הורדת קובץ Excel לפי אותם פרמטרי סינון |
| GET | `/transactions/import/template` | הורדת קובץ תבנית ליבוא |
| POST | `/transactions/import/preview` | העלאת `.xlsx` / `.csv` (שדה `file`), מחזיר שורות מנותחות לתצוגה מקדימה |
| POST | `/transactions/bulk` | יצירה גורפת: `rows[]` (עד 1000) |

## קטגוריות – `/api/categories`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/categories?type=` | רשימה |
| POST | `/categories` | `name, type, icon?, color?` |
| PUT | `/categories/:id` | `name?, icon?, color?` |
| DELETE | `/categories/:id` | נחסם (409) אם יש עסקאות בקטגוריה |

## תקציבים – `/api/budgets`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/budgets?year=&month=` | תקציבים עם `spent, remaining, percent, status` לחודש המבוקש |
| POST | `/budgets` | `category, amount, alertThreshold?` (תקציב אחד לקטגוריה) |
| PUT | `/budgets/:id` | `amount?, alertThreshold?` |
| DELETE | `/budgets/:id` | מחיקה |

## יעדי חיסכון – `/api/goals`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/goals` | יעדים עם `progress`: `percent, expectedPercent, status, monthlyNeeded, daysLeft`, ולחודש הנוכחי `depositedThisMonth, leftThisMonth, affordable`. ב‑`meta.month`: `income, expense, deposited, free, needed, shortfall, status` (`covered / ok / short`) |
| POST | `/goals` | `name, targetAmount, targetDate, initialAmount?, icon?, color?` |
| PUT | `/goals/:id` | עדכון |
| DELETE | `/goals/:id` | מחיקה |
| POST | `/goals/:id/deposit` | `amount` (חיובי = הפקדה, שלילי = משיכה), `note?` |

**הקשר להוצאות:** הכסף שנשאר החודש (הכנסות פחות הוצאות, ופחות מה שכבר הופקד ליעדים) מתחלק בין היעדים לפי תאריך היעד, הקרוב קודם. כל קנייה מקטינה את הסכום הזה. יעד שהכסף לא מספיק לו מסומן `affordable: false`.

## הוראות קבע – `/api/recurring`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/recurring` | רשימה |
| POST | `/recurring` | `description, amount, category, startDate, type?, frequency?, merchant?` |
| PUT | `/recurring/:id` | עדכון, כולל `isActive` להשהיה |
| DELETE | `/recurring/:id` | מחיקה |
| POST | `/recurring/:id/run` | ביצוע מיידי: יוצר עסקה ומקדם את התאריך הבא |

## מוצרים – `/api/products`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/products?search=&sort=` | קטלוג המוצרים מתוך הקבלות. `sort`: `recent / spent / purchases / name` |
| GET | `/products/detail?key=` | היסטוריית מחירים והשוואת בתי עסק למוצר אחד |

## קבלות – `/api/receipts`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/receipts` | 30 הקבלות האחרונות |
| POST | `/receipts/scan` | העלאת תמונה / PDF (שדה `file`), פענוח ב‑Gemini, מחזיר שורות מוצר לבדיקה |
| POST | `/receipts/:id/confirm` | `merchant, date, items[]` – כל פריט נשמר כעסקה נפרדת |
| GET | `/receipts/:id/file` | הקובץ המקורי (לבעלים בלבד) |
| DELETE | `/receipts/:id` | מחיקה |

## דוחות – `/api/reports`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/reports/monthly?year=&month=` | סיכום חודשי, השוואה לחודש הקודם, סדרה יומית, פילוח קטגוריות, בתי עסק מובילים. `month` מ‑0 עד 11 |

## בדיקת תקינות

`GET /api/health` – ללא אימות, משמש את Docker ואת ה‑load balancer.
