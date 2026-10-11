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

## Working Notes

- `npm run dev` (root) runs both sides; Vite proxies `/api` to port 5000.
- API responses are `{ success, data, meta? }` or `{ success: false, message, details? }`; messages are in Hebrew because they are shown to users.
- Never commit `.env` files. `backend/.env.example` documents every variable.
- Before finishing: `npm test`, `npm run lint`, `npm run build`.
