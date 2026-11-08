# SmartHome in one container: the API also serves the React app, from the same
# address. That keeps the login cookie first-party and the whole app under one
# security policy. Works on any host that runs a Dockerfile (see render.yaml).

# ---- Build the React app ----
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- Run the API ----
FROM node:22-alpine
ENV NODE_ENV=production TZ=Asia/Jerusalem FRONTEND_DIR=/app/public PORT=5000
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/src ./src
COPY --from=web /web/dist ./public
RUN mkdir -p uploads && chown -R node:node /app

USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "src/server.js"]
