#!/bin/sh
# Runs every time the codespace starts: the API (with the Codespaces secrets,
# e.g. GEMINI_API_KEY) and the web app on port 5713, the port shared publicly.
cd "$(dirname "$0")/.."
setsid nohup npm --prefix backend run dev > /tmp/api.log 2>&1 < /dev/null &
setsid nohup npm --prefix frontend run dev -- --port 5713 --strictPort > /tmp/web.log 2>&1 < /dev/null &
