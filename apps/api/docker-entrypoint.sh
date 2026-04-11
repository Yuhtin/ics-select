#!/bin/sh
set -e

echo "[entrypoint] Applying Prisma migrations..."
prisma migrate deploy --schema=/app/node_modules/@ics-select/prisma/prisma/schema.prisma
echo "[entrypoint] Migrations complete. Starting API..."

exec "$@"
