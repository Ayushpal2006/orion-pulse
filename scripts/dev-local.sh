#!/usr/bin/env bash
# Run the Orion POS / ApkaBill stack locally.
#   Frontend: http://localhost:8081   (frontend/.env.development.local -> API at :8080)
#   Backend:  http://localhost:8080   (backend/.env -> postgres @ localhost:5432/orion)
#
# Usage:  ./scripts/dev-local.sh          # start frontend + backend (Ctrl+C stops both)
#
# The local "orion" database lives in Homebrew postgresql@18. If postgresql@17 is also
# installed it grabs port 5432 first and the backend fails with: role "postgres" does not exist.
# Fix once with:
#   brew services stop postgresql@17 && brew services start postgresql@18
set -euo pipefail
cd "$(dirname "$0")/.."

if ! psql -h localhost -U postgres -d orion -Atc 'select 1' >/dev/null 2>&1; then
  echo "Cannot reach the 'orion' database as user 'postgres' on localhost:5432." >&2
  echo "Run: brew services stop postgresql@17 && brew services start postgresql@18" >&2
  exit 1
fi

trap 'kill 0' EXIT INT TERM
(cd frontend && npm run dev) &
(cd backend && npm run dev) &
wait
