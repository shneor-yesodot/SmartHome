#!/bin/sh
# Runs once, when the codespace is created: dependencies, server secrets and demo data.
set -e
cd "$(dirname "$0")/.."
npm run setup

# Random JWT secrets for this codespace only (the dev defaults are public in the repo)
if [ ! -f backend/.env ]; then
  gen() { node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"; }
  printf 'JWT_SECRET=%s\nJWT_REFRESH_SECRET=%s\n' "$(gen)" "$(gen)" > backend/.env
  chmod 600 backend/.env
fi

npm run seed
