# AGENTS.md

## Project Context

SmartHome is a household finance app: a React + Vite frontend (`frontend/`) and a Node.js + Express + MongoDB backend (`backend/`, CommonJS). Start with `README.md` for setup, environment variables and commands.

## Key Files

- `backend/src/app.js`: Express setup (security middleware, routes, error handler). `server.js` starts it.
- Request flow: `routes/` → `middleware/validate.js` (Joi, unknown fields stripped) → `controllers/` → `managers/` (business logic) → `repositories/` (every query scoped to the user) → `models/`.
- `backend/src/managers/auth.manager.js`: sessions (access + rotating refresh tokens stored as `User.sessions`), e-mail verification (only when SMTP is configured), password reset, Google sign-in.
- `backend/src/config/env.js`: the only place that reads `process.env`; loads `backend/.env`.
- `backend/src/config/db.js`: with no `MONGO_URI` in development, starts an embedded MongoDB on port 27018 (data in `backend/.data`).
- `frontend/src/services/api.js`: Axios instance; attaches the access token and refreshes it once on 401.
- `frontend/src/context/AuthContext.jsx`: current user, login/register/verify/logout.
- Sessions: the access token stays in memory; the refresh token is only ever in the httpOnly cookie `sh_refresh`, never in a response body. `ALLOWED_EMAILS` decides who may open an account (empty = closed in production).
- `backend/src/services/statement.service.js` + `managers/import.manager.js`: bank and card statement import. Every line has an `importHash`; lines that would count money twice start switched off.
- `backend/src/utils/sheetSync.js` (the comparison logic) + `managers/sheets.manager.js`: Google Sheets sync. Removing a row in the sheet never deletes from the app.
- `Account` (card / checking / cash) is what `Transaction.account` and `RecurringPayment.account` point to. `Transaction.isRefund` is income in the books but excluded from maaser.
- `Transaction.purchase`: items bought together are separate transactions sharing this id, so reports work unchanged. A statement line equal to their total links to them instead of counting again; one item holds its `importHash`, and passes it on when deleted. Items saved after the statement replace its line (`payment`). Matching rules (3 days, 5% tolerance, same store first) live in `utils/purchaseMatch.js`; a close amount is only ever offered, never linked on its own. Once linked, the items always add up to the charge: edits and deletes move the difference into the `ADJUSTMENT_NAME` item (`transaction.manager.js` `planAdjustment`).
- Product names: `utils/text.js` `toProductKey` ignores word order and unit spelling. Saving adopts the spelling already in use (`knownProductNames` in `transaction.manager.js`), and the products page groups by the key computed from the name, so older rows group too.
- Concurrency: one-shot transitions are claimed atomically, never read-then-write. A receipt is claimed by `receiptRepository.claim`, a standing-order occurrence by `recurringRepository.claimRun` (the job and "run now" both use it), and a Sheets sync by the in-process `syncing` set. Rows created from the sheet carry `sheetKey`, so a retried sync does not create them twice.
- `SmartHome.exe` (source `launcher/SmartHome.cs`, built by `launcher/build.ps1`): the double-click local start. It sets `HOST=127.0.0.1`, `PORT=5180`, `FRONTEND_DIR` and `STOP_WITH_LAUNCHER`; the server stops cleanly when its stdin closes. Rebuild and commit the exe whenever the source changes.
- Root `Dockerfile` + `render.yaml`: one container where the API also serves the built frontend (`FRONTEND_DIR`).
- Screens: six in the menu (`constants/nav.js`). "תכנון" (`pages/Plan.jsx`) and "קבלות ומוצרים" (`pages/Receipts.jsx`) are `TabbedPage`s that show older screens as tabs (`?tab=`); `PageHeader` hides its title inside a tab (`EmbeddedPage`). Old addresses (`/budgets`, `/products`…) redirect. Settings open from the user button in the top bar.
- Adding: `AddButtons` (expense / income / receipt) on every screen; the receipt goes to the receipts screen, the only receipt flow. One import button (`ImportFileModal`): the server answers a file in the app's own template with `details.format = 'smarthome-template'` (`statementService.isAppTemplate`), and the dialog switches to the template import.
- The calendar (Gregorian / Hebrew) is a setting (`ProfileCard`); only Reports keeps a toggle to compare.
- `frontend/public/sw.js`: caches only the app's own files. It must never cache `/api`.

## Working Notes

- `npm run dev` (root) runs both sides; Vite proxies `/api` to port 5000.
- API responses are `{ success, data, meta? }` or `{ success: false, message, details? }`; messages are in Hebrew because they are shown to users.
- Never commit `.env` files. `backend/.env.example` documents every variable.
- Before finishing: `npm test`, `npm run lint`, `npm run build`.
