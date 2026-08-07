#!/usr/bin/env bash

set -euo pipefail

# Use:
#   NEON_URL      = Neon DIRECT / UNPOOLED connection string
#   RAILWAY_URL   = Railway DATABASE_PUBLIC_URL
#
# Never commit real credentials to GitHub.

export NEON_URL='YOUR_NEON_DIRECT_URL'
export RAILWAY_URL='YOUR_RAILWAY_PUBLIC_URL'

mkdir -p ~/postgres-migration
cd ~/postgres-migration

psql "$RAILWAY_URL" -c "SELECT current_database(), current_user;"
psql "$NEON_URL" -c "SELECT current_database(), current_user;"

pg_dump \
  --dbname="$RAILWAY_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  --file=railway.dump

pg_restore \
  --dbname="$NEON_URL" \
  --no-owner \
  --no-acl \
  --exit-on-error \
  --verbose \
  railway.dump

psql "$NEON_URL" -c "ANALYZE;"

unset NEON_URL RAILWAY_URL
