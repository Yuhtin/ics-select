#!/usr/bin/env bash
# Starts the local dev stack: Postgres (docker) → prisma migrate → api + web (turbo).
# Usage: ./scripts/dev.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf "\033[1;34m[dev]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[dev]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[dev]\033[0m %s\n" "$*" >&2; exit 1; }

command -v pnpm >/dev/null || die "pnpm not found (install with: npm i -g pnpm@9.12.0)"
command -v docker >/dev/null || die "docker not found"

if [[ ! -f "apps/api/.env" ]]; then
  warn "apps/api/.env missing — copy apps/api/.env.example and fill in secrets, then rerun."
  exit 1
fi

if [[ ! -f ".env" ]]; then
  warn "root .env missing — copying .env.example (controls docker-compose postgres creds)"
  cp .env.example .env 2>/dev/null || true
fi

log "ensuring Postgres (pgvector/pg16) is running"
docker compose up -d postgres >/dev/null

log "waiting for Postgres to accept connections"
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U ics -d ics_select >/dev/null 2>&1; then
    break
  fi
  sleep 1
  [[ $i -eq 30 ]] && die "Postgres did not become ready in 30s"
done

log "applying Prisma migrations"
# Prisma runs from packages/prisma/ and doesn't read apps/api/.env, so pass DATABASE_URL explicitly.
set -o allexport; . apps/api/.env; set +o allexport
pnpm --filter @ics-select/prisma exec prisma migrate deploy >/dev/null

log "building @ics-select/shared (api consumes compiled output)"
pnpm --filter @ics-select/shared build >/dev/null

log "starting api (:3001) + web (:3000) via turbo — Ctrl+C to stop"
exec pnpm dev
