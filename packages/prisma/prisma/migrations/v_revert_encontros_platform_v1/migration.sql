-- Revert of u_encontros_platform_v1 (Encontros Platform Phase 1A).
-- The Encontros feature was reverted at the code level via force-push to
-- 72a49ff, but the prod DB had already received u_encontros_platform_v1
-- (which created the tables below) when the container redeployed. This
-- migration cleans up those tables so prod schema matches the reverted code.
--
-- Idempotent (uses IF EXISTS) so it is safe against:
--   - prod, where the tables exist from u_encontros_platform_v1
--   - CI / fresh local DBs, where the u_ migration file no longer exists
--     and the tables were never created
--
-- The corresponding u_encontros_platform_v1 migration FILE was removed from
-- the repo by the same force-push that brought back HEAD to 72a49ff. The
-- entry in `_prisma_migrations` for u_encontros_platform_v1 is left in place
-- (prisma migrate deploy is permissive about extra rows there).

DROP TABLE IF EXISTS "EncontroAttendance";
DROP TABLE IF EXISTS "EncontroTopic";
DROP TABLE IF EXISTS "Encontro";
DROP TYPE IF EXISTS "EncontroStatus";
