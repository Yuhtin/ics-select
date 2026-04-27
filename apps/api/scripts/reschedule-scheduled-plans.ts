/**
 * Reschedule every SCHEDULED WeeklyPlan to a new publishAt.
 *
 * Why: one-shot operation when the program slips and the admin wants every
 * pre-baked plan to flip together. The scheduled-publish cron (every minute)
 * picks up the new publishAt automatically — no other side effects to wire.
 *
 * Defaults to a dry-run. Pass `--apply` to actually write.
 *
 * Run from repo root:
 *   pnpm --filter @ics-select/api reschedule:plans              # dry-run
 *   pnpm --filter @ics-select/api reschedule:plans -- --apply   # writes
 */
import { PrismaClient } from '@ics-select/prisma';

// 2026-04-27 13:20 America/Sao_Paulo (BRT, UTC-3, no DST since 2019) = 16:20 UTC.
const TARGET_PUBLISH_AT = new Date('2026-04-27T16:20:00Z');

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();

  try {
    const plans = await prisma.weeklyPlan.findMany({
      where: { status: 'SCHEDULED' },
      select: {
        id: true,
        userId: true,
        weekStart: true,
        publishAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: [{ user: { name: 'asc' } }, { weekStart: 'asc' }],
    });

    console.log(`\nFound ${plans.length} SCHEDULED plan(s).\n`);
    if (plans.length === 0) {
      console.log('Nothing to do.');
      return;
    }

    for (const p of plans) {
      const who = p.user.name ?? p.user.email;
      const weekStartStr = p.weekStart.toISOString().slice(0, 10);
      const oldStr = p.publishAt ? p.publishAt.toISOString() : '(null)';
      console.log(
        `  ${who.padEnd(28)}  week ${weekStartStr}  publishAt: ${oldStr}  →  ${TARGET_PUBLISH_AT.toISOString()}`,
      );
    }

    if (!apply) {
      console.log(
        `\nDry-run. Re-run with --apply to set publishAt = ${TARGET_PUBLISH_AT.toISOString()} (07:00 São Paulo) on all ${plans.length} plan(s).\n`,
      );
      return;
    }

    const result = await prisma.weeklyPlan.updateMany({
      where: { status: 'SCHEDULED' },
      data: { publishAt: TARGET_PUBLISH_AT },
    });
    console.log(`\nUpdated ${result.count} plan(s). Done.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
