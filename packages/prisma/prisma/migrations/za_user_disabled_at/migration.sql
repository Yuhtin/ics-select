-- Additive only: nullable column, no default, no backfill. Every existing
-- row keeps disabledAt = NULL, which means "active" — no behavior change
-- for anyone until an admin sets it explicitly.
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);
