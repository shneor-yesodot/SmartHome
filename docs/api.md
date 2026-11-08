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

**סשן** = `{ user, token }` ועוגיית `sh_refresh`. ה‑`token` (access, ברירת מחדל 15 דקות) נשלח בכל בקשה. העוגייה (ברירת מחדל 7 ימים, `HttpOnly`, `SameSite=Strict`, ו‑`Secure` בפרודקשן) משמשת רק לקבלת טוקן חדש, וסקריפטים בדף לא יכולים לקרוא אותה:

- כל רענון מחליף את ה‑refresh token (rotation).
- שימוש חוזר ב‑token שכבר הוחלף נחשב גניבה ומבטל את כל הסשנים של המשתמש. יוצא מן הכלל: חלון של 30 שניות, בשביל שתי לשוניות שמרעננות יחד.

**אימות מייל** פעיל רק כשמוגדר SMTP. במקרה כזה הרשמה והתחברות של חשבון לא מאומת מחזירות `{ verificationRequired: true, email }` במקום סשן.

**הרשמה** מותרת רק לכתובות שב‑`ALLOWED_EMAILS`. אם המשתנה ריק, היא סגורה בפרודקשן (403) ופתוחה בפיתוח. אותו כלל חל על חשבון חדש דרך Google.

**אימות דו‑שלבי:** בחשבון שהפעיל אותו, כל מסלול כניסה (סיסמה, Google, איפוס סיסמה) מחזיר `{ twoFactorRequired: true, challenge }` במקום סשן. קוד שכבר נוצל נדחה. חמישה כישלונות נועלים את החשבון ל‑15 דקות.

| שיטה | נתיב | תיאור | גוף הבקשה |
|---|---|---|---|
| GET | `/auth/config` | מה זמין בשרת: `{ google, emailVerification, registration }` | – |
| POST | `/auth/register` | הרשמה ויצירת קטגוריות ברירת מחדל. מחזיר סשן או `verificationRequired` | `name, email, password` |
| POST | `/auth/login` | התחברות. מחזיר סשן, `verificationRequired` או `twoFactorRequired` | `email, password` |
| POST | `/auth/login/2fa` | סיום ההתחברות עם קוד מהאפליקציה או קוד גיבוי. מחזיר סשן | `challenge, code` |
| POST | `/auth/verify-email` | אימות הקוד (6 ספרות, 10 דקות). עד 5 קודים שגויים בשעה, גם אם נשלחו כמה קודים. מחזיר סשן | `email, code` |
| POST | `/auth/resend-code` | שליחת קוד חדש. התשובה זהה בכל מקרה, וקוד חדש לא מאפס את מניין הטעויות של השעה | `email` |
| POST | `/auth/forgot-password` | שליחת קישור איפוס (תקף שעה). התשובה זהה בכל מקרה | `email` |
| POST | `/auth/reset-password` | סיסמה חדשה: מבטל את כל הסשנים ומחזיר סשן חדש או `twoFactorRequired` | `token, password` |
| POST | `/auth/refresh` | טוקן חדש ועוגייה חדשה | – (העוגייה) |
| POST | `/auth/logout` | ביטול ה‑refresh token ומחיקת העוגייה | – (העוגייה) |
| GET | `/auth/google` | הפניה להתחברות עם Google (`?returnTo=/path`) | – |
| GET | `/auth/google/callback` | חזרה מ‑Google. קובע את העוגייה ומפנה אל `/oauth-callback`, או אל `/login` עם `challenge` ב‑fragment | – |
| POST | `/auth/2fa/setup` 🔒 | סוד חדש וקוד QR. לא פעיל עד האישור | `password` |
| POST | `/auth/2fa/enable` 🔒 | הפעלה עם קוד מהאפליקציה. מחזיר 8 קודי גיבוי, פעם אחת בלבד | `code` |
| POST | `/auth/2fa/disable` 🔒 | כיבוי | `password, code` |
| GET | `/auth/me` 🔒 | המשתמש המחובר | – |
| PATCH | `/auth/me` 🔒 | עדכון שם, העדפות התראה ולוח שנה | `name?, notifications?, calendar?` (`gregorian` / `hebrew`) |
| PUT | `/auth/password` 🔒 | החלפת סיסמה: מבטל את שאר הסשנים ומחזיר סשן חדש | `currentPassword, newPassword` |

🔒 = דורש התחברות. כל הנתיבים שמכאן והלאה דורשים התחברות.

## חודשים עבריים ולועזיים

כל מה שמחושב לפי חודש (דשבורד, תקציבים, יעדים, תובנות ודוחות) נספר לפי הגדרת המשתמש `calendar`: חודש לועזי או חודש עברי (למשל חשוון תשפ״ז, 12.10–10.11.2026). הטווחים מחושבים בשרת עם לוח השנה העברי של Intl, בלי ספרייה חיצונית.

בדוחות ובתקציבים אפשר לבקש חודש מסוים:
- `calendar=gregorian|hebrew` (ברירת מחדל: הגדרת המשתמש)
- `date=YYYY-MM-DD`: כל יום בתוך החודש המבוקש
- או `year=&month=` (`month` מ‑0 עד 11): תמיד חודש לועזי

בתשובה מופיע `period`: `{ calendar, name, label, start, end, days, key }`, למשל `label: "חשוון תשפ״ז"`, ו‑`end` הוא היום האחרון בחודש.

## מעשרות וצדקה – `/api/maaser`

תרומה היא הוצאה בקטגוריה המסומנת `isMaaser` ("צדקה ומעשרות", נוצרת אוטומטית). הנמען נשמר בשדה `merchant`, ולכן תרומות נספרות גם במאזן ובדוחות. היעד החודשי הוא אחוז מהכנסות החודש או סכום קבוע. מה שלא ניתן (או ניתן מעבר ליעד) עובר לחודש הבא, החל מ‑`startDate`.

| שיטה | נתיב | תיאור |
|------|------|-------|
| GET | `/maaser?calendar=&date=` | חודש לועזי או עברי: `target, given, carryOver, remaining, income`, רשימת `donations`, סיכום `byRecipient`, `history` של 12 חודשים ו‑`settings` |
| PUT | `/maaser/settings` | `mode` (`percent` / `fixed`), `percent?`, `amount?`, `startDate?` |
| POST | `/maaser/donations` | `recipient, amount, date, notes?`: נשמר כעסקת הוצאה בקטגוריית המעשרות |

## דשבורד – `/api/dashboard`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/dashboard` | כל נתוני הדשבורד בבקשה אחת: סיכום (`income, expense, monthBalance, balance, savedInGoals, available`; `available` = היתרה פחות הכסף שהופקד ליעדים), ניקוד בריאות, תחזית, 6 חודשים, פילוח קטגוריות, לוח יומי, תקציבים, יעדים ו‑`savingsPlan` (כמו `meta.month` ביעדים), עסקאות אחרונות |
| POST | `/dashboard/insights` | תובנות (Gemini, או מנוע כללים כשאין מפתח) |

## עסקאות – `/api/transactions`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/transactions` | רשימה עם סינון ודפדוף. פרמטרים: `page, limit, type, category, account, chargeDate, source, from, to, search` |
| POST | `/transactions` | יצירה: `type, amount, category, description, date, merchant?, notes?, productName?, quantity?, account?, chargeDate?`. בכרטיס עם יום חיוב, `chargeDate` מחושב אם לא נשלח |
| GET | `/transactions/:id` | עסקה בודדת |
| PUT | `/transactions/:id` | עדכון. בפריט מקנייה שקושרה לחיוב בכרטיס, שינוי סכום עובר לשורת "הפרש מול החיוב בכרטיס" כך שהסכום הכולל נשאר החיוב (400 אם הפריטים יעלו עליו). את שורת ההפרש עצמה, או סוג הפריט, אי אפשר לשנות (409) |
| DELETE | `/transactions/:id` | מחיקה. בקנייה שקושרה לחיוב, סכום הפריט שנמחק עובר לשורת ההפרש. שורת ההפרש נמחקת רק כשהיא אחרונה (409 לפני כן) |
| GET | `/transactions/export` | הורדת קובץ Excel לפי אותם פרמטרי סינון |
| GET | `/transactions/import/template` | הורדת קובץ תבנית ליבוא |
| POST | `/transactions/import/preview` | העלאת `.xlsx` / `.csv` (שדה `file`), מחזיר שורות מנותחות לתצוגה מקדימה |
| POST | `/transactions/bulk` | יצירה גורפת: `rows[]` (עד 1000) |
| POST | `/transactions/basket` | קנייה אחת עם כמה מוצרים: `merchant?, date, notes?, account?, payment?, items[]` (`name, quantity?, total, category?`, עד 200). כל מוצר נשמר כעסקת הוצאה נפרדת, והם חולקים `purchase`. עם `payment` הפריטים מחליפים את שורת הדף הזו (ראו למטה) |
| POST | `/transactions/:id/split` | מפצל הוצאה לפריטים: `items[]` (לפחות 2). הסכום חייב להיות שווה לעסקה (אחרת 400), והכרטיס ומועד החיוב נשמרים |
| GET | `/transactions/:id/purchase` | כל הפריטים של הקנייה שהעסקה שייכת אליה: `merchant, date, account, chargeDate, total, matched, items[]`. `matched` אומר אם שורת הדף קושרה אליהם |
| GET | `/transactions/payment-candidates?date=&total=&merchant=` | עד 5 שורות מדף שיובא, שקנייה שנשמרת עכשיו עשויה להיות: הוצאה עם `importHash`, עד 3 ימים מהתאריך, ובהפרש של עד 5% (לפחות 2 ₪). סכום זהה קודם, אחר כך אותו בית עסק, אחר כך התאריך הקרוב. בכל אחת `diff` (החיוב פחות הקנייה) ו‑`sameMerchant` |

**קנייה מול שורה בדף.** אותו כסף לא נספר פעמיים, בשני הכיוונים:
- **הפריטים נרשמו קודם:** שורה בדף שסכומה שווה לפריטים, עד 3 ימים מתאריכם, מקושרת אליהם (`flag: items`). אם כמה קניות מתאימות, מועדפת זו מאותו בית עסק. שורה שרק קרובה בסכום מקבלת `suggestion` ונשארת שורה רגילה, עד שהמשתמש בוחר לקשר (`purchase` + `adjust: true` ב‑commit).
- **הדף יובא קודם:** `payment` ב‑`/transactions/basket` או ב‑`/receipts/:id/confirm` הופך את השורה לפריט הראשון, כך שטביעת הדף, הכרטיס ומועד החיוב נשמרים. המסך מציע אותה דרך `payment-candidates`, וסכום זהה נבחר מראש.
- **הפרש קטן:** חיוב גבוה מהפריטים מוסיף פריט "הפרש מול החיוב בכרטיס". חיוב נמוך יותר (בדרך כלל הנחה) יורד מהפריט היקר. שורה שכבר קושרה, או הפרש גדול מהמותר, מחזירים 409.
- **קבלה עם מוצר אחד** היא גם קנייה (`purchase`), כדי ששורת הדף תמצא אותה.

## כרטיסים וחשבונות – `/api/accounts`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/accounts` | כל אמצעי התשלום |
| GET | `/accounts/overview` | סיכום חודש לכל אמצעי תשלום: הוצאה נטו, קטגוריות והחיוב הבא. פרמטרים: `calendar, date` |
| POST | `/accounts` | יצירה: `name, kind? (credit / bank / cash), last4?, issuer?, billingDay?, color?`. נשמרות רק 4 ספרות אחרונות |
| PUT | `/accounts/:id` | עדכון |
| DELETE | `/accounts/:id` | מחיקה. העסקאות והוראות הקבע נשארות, בלי שיוך |
| GET | `/accounts/:id/charges` | 12 החיובים האחרונים: `date, total, count` |

## יבוא דפי בנק ואשראי – `/api/imports`

| שיטה | נתיב | תיאור |
|---|---|---|
| POST | `/imports/statement/preview` | העלאת `.xlsx`, `.xls`, `.csv` או `.html` (שדה `file`). לא שומר דבר. מחזיר `kind, rows[], newCards[], summary` |
| POST | `/imports/statement/commit` | שמירה: `rows[]` (עד 2000) ו‑`account?`. מחזיר `{ created, linked, skipped }` |

בכל שורה: `include` קובע אם היא מסומנת כברירת מחדל, ו‑`flag` מסביר למה לא: `imported` (כבר יובאה), `settlement` (חיוב כרטיס בעו"ש) או `duplicate` (נראה שכבר נרשמה ידנית או כהוראת קבע). זיכוי בכרטיס נשמר עם `isRefund`: נספר כהכנסה בדוחות, אך לא בחישוב המעשר.

## Google Sheets – `/api/sheets`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/sheets` | מצב החיבור וכתובת חשבון השירות |
| POST | `/sheets/connect` | חיבור: `spreadsheet` (קישור או מזהה), `mode? (backup / two-way)`, `autoSync?` |
| PATCH | `/sheets` | שינוי `mode` או `autoSync` |
| DELETE | `/sheets` | ניתוק. הגיליון עצמו נשאר |
| GET | `/sheets/preview` | מה סנכרון דו‑כיווני היה עושה, בלי לשנות דבר |
| POST | `/sheets/sync` | סנכרון עכשיו. מחזיר `pushed, created, updated, conflicts, restored, invalid`. 409 אם סנכרון אחר של אותו משתמש רץ. שורה חדשה מהגיליון נזכרת לפי הגיליון, מספר השורה והתוכן שלה, כך שסנכרון שנכשל לפני שהמזהים נכתבו לגיליון לא יוצר אותה שוב |

## קטגוריות – `/api/categories`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/categories?type=` | רשימה |
| POST | `/categories` | `name, type, icon?, color?` |
| PUT | `/categories/:id` | `name?, icon?, color?` |
| DELETE | `/categories/:id` | נחסם (409) אם יש עסקאות בקטגוריה |
| POST | `/categories/import/preview` | קובץ `file`: קורא מגיליון סיכום את העמודות שבין "חודש" ל"סה״כ". מחזיר `expense, income, removed` בלי לשמור |
| POST | `/categories/import/commit` | `expense[], income[]`: מוסיף את החדשות, מסיר ברירות מחדל שלא בשימוש, ועמודת המעשר משנה את שם קטגוריית המעשר |

## תקציבים – `/api/budgets`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/budgets?calendar=&date=` | תקציבים עם `spent, remaining, percent, status` לחודש המבוקש (ברירת מחדל: החודש הנוכחי בלוח של המשתמש) |
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
| POST | `/recurring/:id/run` | ביצוע מיידי: יוצר עסקה ומקדם את התאריך הבא. `nextRun?`: התאריך שהמסך הציג. אם הוא השתנה בינתיים (המשימה המתוזמנת רצה, או לחיצה כפולה), מוחזר 409 ולא נרשם כלום. לפני מועד החיוב זה תשלום מוקדם של התקופה; באיחור התאריך הבא שומר על היום בחודש |

**הוראת קבע:** היום בחודש נשמר (`dayOfMonth`), כך שחיוב ב‑31 עובר ל‑28 בפברואר וחוזר ל‑31 במרץ. חידוש אחרי השהיה ממשיך מהיום והלאה, בלי לרשום את התקופות שהושהו. שינוי `startDate` לתאריך עבר כן רושם את התקופות שמאז, כי זו בחירה מפורשת.

## מוצרים – `/api/products`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/products?search=&sort=` | קטלוג המוצרים מתוך הקבלות. `sort`: `recent / spent / purchases / name` |
| GET | `/products/detail?key=` | היסטוריית מחירים והשוואת בתי עסק למוצר אחד |

## קבלות – `/api/receipts`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/receipts?page=&limit=` | הקבלות, מהחדשה לישנה, עם הקטגוריה של כל מוצר. `meta.pagination` כמו בעסקאות (ברירת מחדל 20 לעמוד) |
| POST | `/receipts/scan` | העלאת תמונה / PDF (שדה `file`), פענוח ב‑Gemini, מחזיר שורות מוצר לבדיקה |
| POST | `/receipts/:id/confirm` | `merchant, date, items[], payment?` – כל פריט נשמר כעסקה נפרדת. עם `payment` הפריטים מחליפים שורה מדף שיובא. מחזיר `created, linked, adjusted` |
| GET | `/receipts/:id/file` | הקובץ המקורי (לבעלים בלבד) |
| DELETE | `/receipts/:id` | מחיקה |

## דוחות – `/api/reports`

| שיטה | נתיב | תיאור |
|---|---|---|
| GET | `/reports/monthly?calendar=&date=` | חודש לועזי או עברי: סיכום, השוואה לחודש הקודם, סדרה יומית, פילוח קטגוריות, בתי עסק מובילים, ו‑`summary` במבנה של טבלת סיכום ביתית (הכנסות, הוצאות שוטפות, הוראות קבע, מאזן) |
| GET | `/reports/periods?calendar=&count=12` | החודשים האחרונים (מהחדש לישן) לבחירת חודש בסינון |

## בדיקת תקינות

`GET /api/health` – ללא אימות, משמש את Docker ואת ה‑load balancer.
