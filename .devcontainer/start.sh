#!/bin/sh
# Runs every time the codespace starts: the API (with the Codespaces secrets,
# e.g. GEMINI_API_KEY) and the web app on port 5713, the port shared publicly.
# Stays in the foreground: Codespaces stops anything this command leaves behind.
cd "$(dirname "$0")/.."
exec npx concurrently -n api,web "npm --prefix backend run dev" "npm --prefix frontend run dev -- --port 5713 --strictPort" > /tmp/app.log 2>&1 < /dev/null
