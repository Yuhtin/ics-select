/**
 * Recovery seed — re-creates the cohort that was wiped on 2026-05-02 18:06 UTC
 * by `prisma migrate reset`. Run AFTER `seed:library` (which restored topics +
 * 366 library items) and AFTER the active cycle row exists.
 *
 * Idempotent: User upserted by email, CycleMembership upserted by
 * (userId, cycleId), WeeklyPlan upserted by (userId, weekStart),
 * WeeklyPlanItem inserted only if not already present for the plan.
 *
 * Members get a single PUBLISHED WeeklyPlan for week 2026-04-27 to 2026-05-03
 * containing the 6 `foundations` topic items (in createdAt order). Outcome
 * is DONE_EASY for the 8 members who completed and PENDING for the 4 who did
 * not. Calendar events / scheduledAt are intentionally null — members re-set
 * availability and re-OAuth Google on next login.
 *
 * Run from repo root:
 *   DATABASE_URL=... pnpm --filter @ics-select/api seed:recovery
 */
import { PrismaClient, type ItemOutcome } from '@ics-select/prisma';

const prisma = new PrismaClient();

const CYCLE_ID = 'cycle-2026-2-hot-stuff';
const WEEK_START = new Date('2026-04-27T00:00:00Z');
const WEEK_END = new Date('2026-05-03T23:59:59.999Z');
const PUBLISHED_AT = new Date('2026-04-27T12:00:00Z');
const COMPLETED_AT = new Date('2026-04-30T12:00:00Z');

type MemberSeed = {
  email: string;
  name: string;
  whatsappPhone: string;
  foundationsOutcome: ItemOutcome;
};

const members: MemberSeed[] = [
  // Completers — all foundations DONE_EASY
  { email: 'anne.figueiroa@sou.inteli.edu.br',  name: 'Anne Figueiroa',                whatsappPhone: '+5581987121365', foundationsOutcome: 'DONE_EASY' },
  { email: 'maria.clara@sou.inteli.edu.br',     name: 'Maria Clara',                   whatsappPhone: '+5528999084257', foundationsOutcome: 'DONE_EASY' },
  { email: 'marcos.marcondes@sou.inteli.edu.br',name: 'Marcos Marcondes',              whatsappPhone: '+5511988457621', foundationsOutcome: 'DONE_EASY' },
  { email: 'lorena.garcia@sou.inteli.edu.br',   name: 'Lorena Garcia',                 whatsappPhone: '+5592981622210', foundationsOutcome: 'DONE_EASY' },
  { email: 'eduardo.maciel@sou.inteli.edu.br',  name: 'Eduardo Hirohito Izawa Maciel', whatsappPhone: '+5512988277091', foundationsOutcome: 'DONE_EASY' },
  { email: 'leunam.jesus@sou.inteli.edu.br',    name: 'Leunam Jesus',                  whatsappPhone: '+5511984839830', foundationsOutcome: 'DONE_EASY' },
  { email: 'cauan.martins@sou.inteli.edu.br',   name: 'Cauan Martins',                 whatsappPhone: '+5588992895332', foundationsOutcome: 'DONE_EASY' },
  { email: 'messias.olivindo@sou.inteli.edu.br',name: 'Messias Olivindo',              whatsappPhone: '+5592981803581', foundationsOutcome: 'DONE_EASY' },
  // Non-completers — all foundations PENDING
  { email: 'raissa.guimaraes@sou.inteli.edu.br',name: 'Raissa Guimaraes',              whatsappPhone: '+5521984377294', foundationsOutcome: 'PENDING'   },
  { email: 'livia.tavares@sou.inteli.edu.br',   name: 'Livia Tavares',                 whatsappPhone: '+5585992196661', foundationsOutcome: 'PENDING'   },
  { email: 'julia.souza@sou.inteli.edu.br',     name: 'Julia Souza',                   whatsappPhone: '+5512992243038', foundationsOutcome: 'PENDING'   },
  { email: 'pedro.souza@sou.inteli.edu.br',     name: 'Pedro Souza',                   whatsappPhone: '+5511989674771', foundationsOutcome: 'PENDING'   },
];

async function main() {
  const foundations = await prisma.libraryItem.findMany({
    where: { topics: { some: { topic: { slug: 'foundations' } } } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true },
  });
  if (foundations.length === 0) {
    throw new Error('No foundations items in library — run seed:library first.');
  }
  console.log(`Foundations items (${foundations.length}):`);
  foundations.forEach((f, i) => console.log(`  ${i}: ${f.title}`));

  const cycle = await prisma.cycle.findUnique({ where: { id: CYCLE_ID } });
  if (!cycle) {
    throw new Error(`Cycle ${CYCLE_ID} not found — create it first.`);
  }
  console.log(`\nCycle: ${cycle.name} (${cycle.startsAt.toISOString().slice(0, 10)} → ${cycle.endsAt.toISOString().slice(0, 10)})\n`);

  for (const m of members) {
    console.log(`→ ${m.email}`);

    const user = await prisma.user.upsert({
      where: { email: m.email },
      create: {
        email: m.email,
        name: m.name,
        whatsappPhone: m.whatsappPhone,
        role: 'MEMBER',
      },
      update: {
        name: m.name,
        whatsappPhone: m.whatsappPhone,
      },
    });

    await prisma.cycleMembership.upsert({
      where: { userId_cycleId: { userId: user.id, cycleId: CYCLE_ID } },
      create: { userId: user.id, cycleId: CYCLE_ID },
      update: {},
    });

    const plan = await prisma.weeklyPlan.upsert({
      where: { userId_weekStart: { userId: user.id, weekStart: WEEK_START } },
      create: {
        userId: user.id,
        cycleId: CYCLE_ID,
        weekStart: WEEK_START,
        weekEnd: WEEK_END,
        status: 'PUBLISHED',
        publishedAt: PUBLISHED_AT,
      },
      update: { status: 'PUBLISHED', publishedAt: PUBLISHED_AT },
    });

    let created = 0;
    for (let i = 0; i < foundations.length; i++) {
      const f = foundations[i]!;
      const existing = await prisma.weeklyPlanItem.findFirst({
        where: { weeklyPlanId: plan.id, libraryItemId: f.id },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.weeklyPlanItem.create({
        data: {
          weeklyPlanId: plan.id,
          libraryItemId: f.id,
          order: i,
          outcome: m.foundationsOutcome,
          completedAt: m.foundationsOutcome === 'DONE_EASY' ? COMPLETED_AT : null,
        },
      });
      created += 1;
    }
    console.log(`  user=${user.id} plan=${plan.id} items=+${created} outcome=${m.foundationsOutcome}`);
  }

  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
