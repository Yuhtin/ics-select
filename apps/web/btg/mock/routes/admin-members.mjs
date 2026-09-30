// Mock routes for /btgadmin-poc/membros and /btgadmin-poc/member/[id].
// Everything derives from db (members, plans, feed, alerts, scoreOf) so the cockpit
// agrees with the ranking on /btgadmin-poc. Plans come from db.plans: admin-cycles.mjs
// seeds the history there (same `plan-<user>-<weekStart>` ids); if it hasn't booted yet
// we seed the missing weeks ourselves and it skips those ids later.
// ponytail: classes/other cycles live in admin-cycles' private state; read through
// db.adminCycles when it's exposed, else fall back to a local copy.

const PHONES = { 'u-ana': '+55 11 99999-9999', 'u-bruno': '+55 11 98888-1234', 'u-lucas': '+55 11 97777-4321', 'u-karina': '+55 21 96666-0000' };
const REFLECTIONS = {
  STUCK: ['Não entendi quando mover o ponteiro da esquerda. Travei no caso com duplicatas.', 'Consegui a força bruta, mas não achei a versão O(n).'],
  DOUBTS: ['Fiz, mas fiquei na dúvida sobre a complexidade de espaço.', 'Entendi a ideia, quero rever os casos de borda.'],
};
const WEEK_LIBS = [
  ['lib-bigo', 'lib-tp', 'lib-lc1', 'lib-sw'],
  ['lib-hash', 'lib-lc20', 'lib-lc3', 'lib-stack'],
  ['lib-lc49', 'lib-trees', 'lib-mono', 'lib-lc104'],
];
const CLASSES = [
  { id: 'cls-1', title: 'Aula 1 · Big-O e Two Pointers', topic: 'arrays', week: -2 },
  { id: 'cls-2', title: 'Aula 2 · Hashing na prática', topic: 'hashing', week: -1 },
  { id: 'cls-3', title: 'Aula 3 · Stacks e monotonic stack', topic: 'stack', week: 1 },
];

let seeded = false;
const retrosBy = new Map();
const invites = [];
const mocks = [];
const notes = [];
const diagnoseCache = new Map();

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const median = (xs) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};
const err = (status, code, message) => ({ status, body: { error: { code, message } } });

function outcomeFor(memberId, score, week, k) {
  const r = hash(`${memberId}:${week}:${k}`) % 100;
  if (r < score * 0.55) return 'DONE_EASY';
  if (r < score * 0.75) return 'DONE_HARD';
  if (r < score * 0.85) return 'DOUBTS';
  if (r < score * 0.92) return 'SKIPPED';
  if (r < score + 12) return 'STUCK';
  return 'PENDING';
}

function seed(db) {
  if (seeded) return;
  seeded = true;
  const { DAY, ymd, ago } = db.helpers;
  const wn = db.weekNumber();
  for (const m of db.MEMBERS) {
    const score = db.scoreOf(m);
    for (let w = 0; w < (m.id === db.ME ? wn - 1 : wn); w += 1) {
      const offset = (w - (wn - 1)) * 7; // day offset from this Monday
      const weekStart = ymd(new Date(db.thisMonday.getTime() + offset * DAY));
      const id = `plan-${m.id.slice(2)}-${weekStart}`;
      if (plansOf(db, m.id).some((p) => p.weekStart === weekStart)) continue;
      const plan = { id, userId: m.id, cycleId: db.CYCLE.id, weekStart, status: 'PUBLISHED', adminNotes: null };
      plan.items = WEEK_LIBS[w % WEEK_LIBS.length].map((libId, k) =>
        db.planItem(id, libId, k, offset + k, 19, 0, offset + k > Math.min(db.todayOffset - 1, 1) && offset === 0 ? 'PENDING' : outcomeFor(m.id, score, w, k)),
      );
      db.plans.set(id, plan);
    }
    // One retro per finished week, fewer for less engaged members.
    const retros = [];
    for (let w = 0; w < wn - 1; w += 1) {
      if (score < 50 && w > 0) continue;
      const weekStart = new Date(db.thisMonday.getTime() + (w - (wn - 1)) * 7 * DAY);
      retros.push({
        id: `retro-${m.id}-${w}`,
        weekStart: `${ymd(weekStart)}T00:00:00.000Z`,
        whatClicked: 'Two Pointers finalmente fez sentido quando desenhei os índices no papel.',
        whatStuck: w === 0 ? 'Ainda erro a condição de parada do while.' : 'Hash maps com chave composta.',
        nextWeekWish: 'Mais problemas médios de LeetCode, menos vídeo.',
        submittedAt: new Date(weekStart.getTime() + 4 * DAY + 20 * 3600_000).toISOString(),
        valuedItem: null,
        stuckItem: null,
      });
    }
    retrosBy.set(m.id, retros.reverse());
  }
  mocks.push(
    { id: 'mock-1', userId: db.ME, cycleId: db.CYCLE.id, type: 'CODING', score: 3, feedback: 'Chegou na solução com dica. Comunicou bem o raciocínio, mas demorou a testar casos de borda.', conductedBy: 'Rafael (BTG)', conductedAt: ago(6 * 24 * 60), topics: ['two-pointers', 'arrays'], createdAt: ago(6 * 24 * 60) },
    { id: 'mock-2', userId: 'u-bruno', cycleId: db.CYCLE.id, type: 'BEHAVIORAL', score: 5, feedback: 'Histórias no formato STAR, claras e com resultado mensurável.', conductedBy: 'Marina', conductedAt: ago(3 * 24 * 60), topics: ['star', 'ownership'], createdAt: ago(3 * 24 * 60) },
  );
  notes.push({ id: 'note-1', aboutId: db.ME, authorId: db.ADMIN.id, text: 'Pediu para priorizar sliding window antes do mock de coding.', createdAt: ago(2 * 24 * 60) });
}

// Reflections are attached lazily so they also land on plans admin-cycles seeded.
function withReflection(db, i) {
  const pool = REFLECTIONS[i.outcome];
  if (pool && i.reflection === null && i.planId !== db.anaPlan.id) i.reflection = pool[hash(i.id) % pool.length];
  return i;
}

// ---------- derived per-member data ----------
const planCycle = (db, p) => p.cycleId ?? db.CYCLE.id;
const plansOf = (db, userId, cycleId = null) =>
  [...db.plans.values()]
    .filter((p) => p.userId === userId && (!cycleId || planCycle(db, p) === cycleId))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
const itemsOf = (db, userId) => plansOf(db, userId).filter((p) => p.status === 'PUBLISHED').flatMap((p) => p.items);

function cycleMeta(db, id) {
  const shared = db.adminCycles?.cycles?.find((c) => c.id === id);
  if (shared) return shared;
  if (!id || id === db.CYCLE.id) return db.CYCLE;
  const monday = db.thisMonday.getTime();
  const W = 7 * db.helpers.DAY;
  // Same dates admin-cycles.mjs uses for its archived cycle.
  return { id, name: 'Ciclo 2026.1', status: 'ARCHIVED', weeksTotal: 8, startsAt: new Date(monday - 20 * W).toISOString(), endsAt: new Date(monday - 12 * W - 60_000).toISOString() };
}

// Alumni (members of past cycles only) live in admin-cycles' state.
const userById = (db, id) => db.memberById.get(id) ?? db.adminCycles?.users?.get(id);
const inCurrentCycle = (db, id) => db.memberById.has(id);

function memberships(db, id) {
  const ids = new Set([...(inCurrentCycle(db, id) ? [db.CYCLE.id] : []), ...plansOf(db, id).map((p) => planCycle(db, p))]);
  return [...ids].map((cid) => {
    const c = cycleMeta(db, cid);
    return { cycleId: c.id, cycleName: c.name, cycleStartsAt: c.startsAt, cycleEndsAt: c.endsAt, status: c.status, isCurrent: c.id === db.CYCLE.id };
  });
}

function attendanceOf(db, m) {
  const shared = db.adminCycles?.classes;
  const classes = shared
    ? shared.filter((c) => c.cycleId === db.CYCLE.id)
    : CLASSES.map((c) => ({ ...c, scheduledAt: db.helpers.atDay(db.thisMonday, c.week * 7 + 2, 19, 30).toISOString(), durationMin: 90, attendances: null }));
  return classes
    .map((c, i) => {
      const past = new Date(c.scheduledAt).getTime() < Date.now();
      const r = hash(`${m.id}:cls${i}`) % 100;
      const local = r < db.scoreOf(m) + 15 ? 'PRESENT' : r < db.scoreOf(m) + 25 ? 'LATE' : 'ABSENT';
      const status = !past ? null : c.attendances ? c.attendances.find((a) => a.userId === m.id)?.status ?? null : local;
      return { classId: c.id, classTitle: c.title, scheduledAt: c.scheduledAt, durationMin: c.durationMin, topic: c.topic ?? null, status };
    })
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}

function retrosOf(db, m) {
  const list = [...(retrosBy.get(m.id) ?? [])];
  const r = m.id === db.ME ? db.memberExtra?.retro : null;
  if (r) {
    const item = (id) => {
      const it = id && db.anaPlan.items.find((x) => x.id === id);
      return it ? { id: it.id, title: db.libById.get(it.libId).title, outcome: it.outcome } : null;
    };
    list.unshift({ id: r.id, weekStart: `${db.helpers.ymd(db.thisMonday)}T00:00:00.000Z`, whatClicked: r.whatClicked, whatStuck: r.whatStuck, nextWeekWish: r.nextWeekWish, submittedAt: r.submittedAt, valuedItem: item(r.valuedItemId), stuckItem: item(r.stuckItemId) });
  }
  return list;
}

function topicCoverage(db, items) {
  return Object.values(db.TOPICS).map((t) => {
    const mine = items.filter((i) => db.libById.get(i.libId).topic.id === t.id);
    const done = mine.filter((i) => db.isPositive(i.outcome)).length;
    return { topicId: t.id, topicSlug: t.slug, topicLabel: t.label, order: t.order, itemsPlanned: mine.length, itemsDone: done, coveragePct: mine.length ? Math.round((done / mine.length) * 100) : 0 };
  });
}

function slot(db, userId, weekStart) {
  const ws = db.helpers.ymd(weekStart);
  const plan = plansOf(db, userId).find((p) => p.weekStart === ws);
  return {
    weekStart: `${ws}T00:00:00.000Z`,
    weekEnd: `${db.helpers.ymd(new Date(weekStart.getTime() + 6 * db.helpers.DAY))}T00:00:00.000Z`,
    inCycle: weekStart.getTime() <= new Date(db.CYCLE.endsAt).getTime(),
    planId: plan?.id ?? null,
    status: plan?.status ?? null,
  };
}

// With no cycleId, the API shows the member's current cycle, else their latest one.
const defaultCycleId = (db, id) =>
  inCurrentCycle(db, id) ? db.CYCLE.id : memberships(db, id).sort((a, b) => b.cycleStartsAt.localeCompare(a.cycleStartsAt))[0]?.cycleId ?? db.CYCLE.id;

function memberDetail(db, m, cycleId) {
  const cyc = cycleMeta(db, cycleId ?? defaultCycleId(db, m.id));
  const current = cyc.id === db.CYCLE.id;
  const plans = plansOf(db, m.id, cyc.id);
  return {
    member: { id: m.id, name: m.name, email: m.email, pictureUrl: null, whatsappPhone: PHONES[m.id] ?? null, track: 'BIG_TECH', role: 'MEMBER' },
    cycle: { id: cyc.id, name: cyc.name, weekNumber: current ? db.weekNumber() : cyc.weeksTotal, weeksTotal: cyc.weeksTotal, startsAt: cyc.startsAt, endsAt: cyc.endsAt },
    memberships: memberships(db, m.id),
    topicCoverage: topicCoverage(db, plans.filter((p) => p.status === 'PUBLISHED').flatMap((p) => p.items)),
    timeline: plans.map((p) => ({
      planId: p.id,
      weekStart: `${p.weekStart}T00:00:00.000Z`,
      weekEnd: `${db.helpers.ymd(new Date(new Date(`${p.weekStart}T00:00:00`).getTime() + 6 * db.helpers.DAY))}T00:00:00.000Z`,
      status: p.status,
      items: [...p.items].sort((a, b) => a.order - b.order).map((i) => {
        const lib = db.libById.get(i.libId);
        withReflection(db, i);
        return { id: i.id, libraryItemId: lib.id, title: lib.title, outcome: i.outcome, reflection: i.reflection, completedAt: i.completedAt, topicLabel: lib.topic.label };
      }),
    })),
    retros: current ? retrosOf(db, m) : [],
    attendance: current ? attendanceOf(db, m) : [],
    planWeeks: {
      current: slot(db, m.id, db.thisMonday),
      next: slot(db, m.id, new Date(db.thisMonday.getTime() + 7 * db.helpers.DAY)),
    },
  };
}

// Same formula as the built-in cycle overview, so the cockpit matches the ranking.
const WEIGHTS = [['Cohort rank', 20], ['Days active', 15], ['Plan completion', 27], ['Retros submitted', 21], ['Class attendance', 5], ['Recency', 12]];
const breakdownOf = (s) =>
  WEIGHTS.map(([label, weight]) => ({ label, weight, value: Math.round(((weight * s) / 100) * 10) / 10, status: s >= 66 ? 'ok' : s >= 33 ? 'warn' : 'bad' }));

function lastSeenOf(db, m) {
  if (m.id === 'u-karina') return db.helpers.ago(9 * 24 * 60);
  const s = db.scoreOf(m);
  return db.helpers.ago(s >= 70 ? 40 : s >= 50 ? 26 * 60 : 4 * 24 * 60);
}

function stats(db, m, range, cycleId) {
  const wn = cycleId === db.CYCLE.id ? db.weekNumber() : cycleMeta(db, cycleId).weeksTotal;
  let plans = plansOf(db, m.id, range === 'all' ? null : cycleId).filter((p) => p.status === 'PUBLISHED').reverse();
  if (range === '7d') plans = plans.slice(-1);
  const items = plans.flatMap((p) => p.items);
  const count = (o) => items.filter((i) => i.outcome === o).length;
  const positive = items.filter((i) => db.isPositive(i.outcome));
  const minutesOf = (xs) => xs.reduce((s, i) => s + db.libById.get(i.libId).estimatedMinutes, 0);
  return { wn, plans, items, count, positive, minutesOf };
}

function cockpit(db, m, cycleId, range) {
  const cyc = cycleMeta(db, cycleId ?? defaultCycleId(db, m.id));
  const detail = memberDetail(db, m, cyc.id);
  const st = stats(db, m, range, cyc.id);
  const others = db.MEMBERS.map((x) => stats(db, x, range, cyc.id));
  const score = db.scoreOf(m);
  const scores = db.MEMBERS.map((x) => db.scoreOf(x));
  const rank = db.rankedMembers().findIndex((x) => x.id === m.id);
  const done = st.positive.length;
  const planned = st.items.length;
  const actual = Math.round(st.minutesOf(st.positive) * 0.9);
  const lastSeen = lastSeenOf(db, m);
  const daysSince = Math.floor((Date.now() - new Date(lastSeen).getTime()) / db.helpers.DAY);
  const rankPct = 1 - rank / db.MEMBERS.length;
  const completion = planned ? done / planned : 0;

  const hits = (t) => [
    daysSince >= t.days && `Sem sessão há ${daysSince} dias`,
    completion <= t.rate && `Conclusão em ${Math.round(completion * 100)}%`,
    rankPct <= t.rank && `No ${t.rank === 0.25 ? 'último quartil' : 'terço inferior'} da turma`,
  ].filter(Boolean);
  const atRisk = hits({ days: 7, rate: 0.25, rank: 0.25 });
  const watch = hits({ days: 3, rate: 0.5, rank: 0.5 });
  const risk = atRisk.length >= 2 ? { status: 'AT_RISK', reasons: atRisk } : watch.length >= 2 ? { status: 'WATCH', reasons: watch } : { status: 'ON_TRACK', reasons: [] };

  const perWeek = st.plans.map((p) => ({
    weekStart: `${p.weekStart}T00:00:00.000Z`,
    byOutcome: Object.fromEntries(['DONE_EASY', 'DONE_HARD', 'DOUBTS', 'STUCK', 'SKIPPED', 'PENDING'].map((o) => [o, p.items.filter((i) => i.outcome === o).length])),
  }));
  const weekMinutes = st.plans.map((p) => Math.round(st.minutesOf(p.items.filter((i) => db.isPositive(i.outcome))) * 0.9));
  const sessionsPerWeek = st.plans.map((p) => p.items.filter((i) => i.outcome !== 'PENDING').length + 1);
  const attendance = detail.attendance.filter((a) => a.status !== null).reverse();
  const cohortPresent = median(db.MEMBERS.map((x) => attendanceOf(db, x).filter((a) => a.status === 'PRESENT').length));
  const feedEvents = db.feed.filter((e) => e.member === m.id).map((e) => ({
    occurredAt: e.at,
    type: e.kind,
    meta: null,
    label: { finished: `Concluiu ${e.itemTitle}`, got_stuck: `Travou em ${e.itemTitle}`, had_doubts: `Marcou dúvidas em ${e.itemTitle}`, posted_retro: 'Enviou a retro' }[e.kind] ?? e.kind,
  }));
  const itemEvents = st.items.filter((i) => i.completedAt && new Date(i.completedAt).getTime() <= Date.now()).map((i) => ({
    occurredAt: i.completedAt,
    type: 'ITEM_OUTCOME',
    meta: { outcome: i.outcome },
    label: `${{ DONE_EASY: 'Concluiu', DONE_HARD: 'Concluiu com esforço', DOUBTS: 'Dúvidas em', STUCK: 'Travou em', SKIPPED: 'Pulou' }[i.outcome]} ${db.libById.get(i.libId).title}`,
  }));
  const recent = [...feedEvents, ...itemEvents].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8);
  const cycleDays = st.wn * 7;

  return {
    member: { id: m.id, name: m.name, email: m.email, pictureUrl: null, track: 'BIG_TECH', whatsappPhone: PHONES[m.id] ?? null },
    cycle: detail.cycle,
    range,
    risk,
    engagement: range === 'all' ? null : {
      score,
      cohortMedian: median(scores),
      breakdown: breakdownOf(score),
      scoreByWeek: Array.from({ length: st.wn }, (_, k) => Math.max(0, Math.round(score - (st.wn - 1 - k) * 6 + (k % 2) * 3))),
    },
    itemsCompleted: {
      total: done,
      planned,
      completionPct: Math.round(completion * 100),
      cohortMedian: median(others.map((o) => o.positive.length)),
      cohortMedianPlanned: median(others.map((o) => o.items.length)),
      byOutcome: Object.fromEntries(['DONE_EASY', 'DONE_HARD', 'DOUBTS', 'STUCK', 'SKIPPED', 'PENDING'].map((o) => [o, st.count(o)])),
      perWeek,
      needsAttention: { total: st.count('STUCK') + st.count('DOUBTS'), stuck: st.count('STUCK'), doubts: st.count('DOUBTS') },
    },
    timeInvested: {
      actualMinutes: actual,
      scheduledMinutes: st.minutesOf(st.items),
      cohortMedianMinutes: median(others.map((o) => Math.round(o.minutesOf(o.positive) * 0.9))),
      naoSeiCount: st.count('STUCK') > 1 ? 1 : 0,
      perWeekMinutes: weekMinutes,
    },
    behavior: {
      sessions: { value: sessionsPerWeek.reduce((s, x) => s + x, 0), cohortMedian: 10, perWeek: sessionsPerWeek },
      daysActive: { value: Math.min(cycleDays, Math.round((score / 100) * cycleDays * 0.7)), cycleDays, cohortMedian: Math.round(cycleDays * 0.45), perWeek: sessionsPerWeek.map((x) => Math.min(7, x)) },
      daysStudying: { value: Math.min(cycleDays, Math.round((score / 100) * cycleDays * 0.55)), cycleDays, cohortMedian: Math.round(cycleDays * 0.35), perWeek: sessionsPerWeek.map((x) => Math.min(7, Math.max(0, x - 1))) },
      retros: { submitted: detail.retros.length, expected: Math.max(0, st.wn - 1) },
      carryOver: { value: st.count('STUCK'), cohortMedian: 1, perWeek: perWeek.map((w) => w.byOutcome.STUCK) },
      lastSeen: { occurredAt: lastSeen, surface: daysSince >= 7 ? 'login' : 'item' },
    },
    topicEngagement: detail.topicCoverage.map((t) => {
      const mins = Math.round(st.minutesOf(st.positive.filter((i) => db.libById.get(i.libId).topic.id === t.topicId)) * 0.9);
      return { topicId: t.topicId, label: t.topicLabel, minutes: mins, pctOfTotal: actual ? Math.round((mins / actual) * 100) : 0, itemsDone: t.itemsDone, itemsPlanned: t.itemsPlanned, cohortMedianMinutes: t.itemsPlanned ? 40 : 0 };
    }),
    classAttendance: {
      present: attendance.filter((a) => a.status === 'PRESENT').length,
      total: attendance.length,
      cohortPresent,
      sessions: attendance.map((a) => ({ scheduledAt: a.scheduledAt, status: a.status })),
    },
    firstSession: { occurredAt: db.helpers.atDay(new Date(db.CYCLE.startsAt), 1, 20).toISOString(), dayOfCycle: 2 },
    recentActivity: recent,
  };
}

function diagnose(db, m) {
  const c = cockpit(db, m, null, 'cycle');
  const first = m.name.split(' ')[0];
  const strongest = [...c.topicEngagement].sort((a, b) => b.minutes - a.minutes)[0];
  const untouched = c.topicEngagement.filter((t) => t.itemsPlanned === 0).map((t) => t.label);
  const stuck = c.itemsCompleted.needsAttention.stuck;
  return [
    `${first} concluiu ${c.itemsCompleted.total} de ${c.itemsCompleted.planned} itens no ciclo (${c.itemsCompleted.completionPct}%), com score de engajamento ${c.engagement.score} contra mediana ${c.engagement.cohortMedian} da turma. ${c.risk.status === 'ON_TRACK' ? 'O ritmo está consistente e não há sinal de risco.' : `Sinais de atenção: ${c.risk.reasons.join('; ').toLowerCase()}.`}`,
    `O maior investimento de tempo foi em ${strongest?.label ?? 'nenhum tópico'}${strongest?.minutes ? ` (${Math.round(strongest.minutes / 60 * 10) / 10}h)` : ''}. ${untouched.length > 0 ? `Ainda não abriu ${untouched.join(', ')}; vale introduzir pelo vídeo conceitual antes da prática.` : 'Todos os tópicos da fase já foram abertos.'}`,
    stuck > 0
      ? `Há ${stuck} ${stuck === 1 ? 'item travado' : 'itens travados'}. As reflexões apontam dificuldade em escolher o invariante do algoritmo, não em sintaxe. Sugestão: retomar com um problema EASY do mesmo padrão e só depois voltar ao original.`
      : 'Nenhum item travado no ciclo. Dá para subir a dificuldade: trocar parte dos EASY por MEDIUM na próxima semana.',
    `Próximo passo recomendado: ${c.behavior.retros.submitted < c.behavior.retros.expected ? 'cobrar a retro pendente e ' : ''}manter 4 a 5 itens por semana, com um mock de coding antes do fim do mês.`,
  ].join('\n\n');
}

export default async function ({ role, body, path, method, url, db }) {
  seed(db);
  const is = (m, re) => method === m && re.test(path);
  const mine =
    path === '/admin/dashboard' || path.startsWith('/admin/invites') || path.startsWith('/admin/mocks') || path.startsWith('/admin/notes') ||
    /^\/admin\/member\/[^/]+(\/cockpit)?$/.test(path) || /^\/members\/[^/]+\/diagnose$/.test(path);
  if (!mine && !is('GET', /^\/cycles$/)) return undefined;
  if (role !== 'admin') return err(403, 'FORBIDDEN', 'Somente admin');

  // Fallback for the invite form; the cycles plugin (sorted earlier) wins if it defines it.
  if (is('GET', /^\/cycles$/)) {
    return { body: [{ id: db.CYCLE.id, name: db.CYCLE.name, startsAt: db.CYCLE.startsAt, endsAt: db.CYCLE.endsAt, status: db.CYCLE.status, rankingVisibleToMembers: db.CYCLE.rankingVisibleToMembers, createdAt: db.CYCLE.startsAt, _count: { memberships: db.MEMBERS.length } }] };
  }

  if (is('GET', /^\/admin\/dashboard$/)) {
    const card = (u, role, items, plans) => ({
      id: u.id, name: u.name, email: u.email, pictureUrl: null, role,
      stats: {
        plansCount: plans,
        doneItems: items.filter((i) => db.isPositive(i.outcome)).length,
        skippedItems: items.filter((i) => i.outcome === 'SKIPPED').length,
        stuckItems: items.filter((i) => i.outcome === 'STUCK').length,
      },
    });
    const alumni = [...(db.adminCycles?.users?.values() ?? [])].filter((u) => !db.memberById.has(u.id));
    const rows = [...db.MEMBERS, ...alumni].map((m) => card(m, 'MEMBER', itemsOf(db, m.id), plansOf(db, m.id).length));
    return { body: [card(db.ADMIN, 'ADMIN', [], 0), ...rows.sort((a, b) => a.name.localeCompare(b.name))] };
  }

  // ---------- invites ----------
  if (is('GET', /^\/admin\/invites$/)) return { body: invites };
  if (is('POST', /^\/admin\/invites$/)) {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(400, 'BAD_REQUEST', 'E-mail inválido');
    if (body.role === 'MEMBER' && !body.cycleId) return err(400, 'BAD_REQUEST', 'cycle-required-for-member');
    let cycle = null;
    if (body.cycleId) {
      const c = (db.adminCycles?.cycles ?? [db.CYCLE]).find((x) => x.id === body.cycleId);
      if (!c) return err(404, 'NOT_FOUND', 'cycle-not-found');
      if (c.status === 'ARCHIVED') return err(400, 'BAD_REQUEST', 'cycle-archived');
      cycle = { id: c.id, name: c.name, startsAt: c.startsAt, endsAt: c.endsAt };
    }
    if ([db.ADMIN, ...db.MEMBERS].some((u) => u.email === email)) return err(409, 'CONFLICT', 'user-already-exists');
    if (invites.some((i) => i.email === email)) return err(409, 'CONFLICT', 'invite-already-exists');
    const inv = { id: db.newId('inv'), email, role: body.role === 'ADMIN' ? 'ADMIN' : 'MEMBER', createdAt: new Date().toISOString(), createdBy: { id: db.ADMIN.id, name: db.ADMIN.name, email: db.ADMIN.email }, cycle };
    invites.unshift(inv);
    return { body: inv };
  }
  const invDel = method === 'DELETE' && path.match(/^\/admin\/invites\/([^/]+)$/);
  if (invDel) {
    const i = invites.findIndex((x) => x.id === invDel[1]);
    if (i < 0) return err(404, 'NOT_FOUND', 'invite-not-found');
    invites.splice(i, 1);
    return { body: { ok: true } };
  }

  // ---------- member detail + cockpit + diagnose ----------
  const detail = path.match(/^\/admin\/member\/([^/]+)(\/cockpit)?$/);
  const diag = path.match(/^\/members\/([^/]+)\/diagnose$/);
  const member = userById(db, (detail ?? diag)?.[1]);
  if ((detail || diag) && !member) return err(404, 'NOT_FOUND', 'Membro não encontrado');
  if (detail && method === 'GET') {
    const cycleId = url.searchParams.get('cycleId');
    if (detail[2]) return { body: cockpit(db, member, cycleId, url.searchParams.get('range') ?? 'cycle') };
    return { body: memberDetail(db, member, cycleId) };
  }
  if (diag && method === 'GET') {
    const hit = diagnoseCache.get(member.id);
    if (hit && Date.now() - new Date(hit.cachedAt).getTime() < 24 * 3600_000) return { body: hit };
    await db.helpers.sleep(1500);
    const out = { markdown: diagnose(db, member), cachedAt: new Date().toISOString() };
    diagnoseCache.set(member.id, out);
    return { body: out };
  }

  // ---------- mocks ----------
  if (is('GET', /^\/admin\/mocks$/)) {
    const userId = url.searchParams.get('userId');
    const cycleId = url.searchParams.get('cycleId');
    return { body: mocks.filter((x) => x.userId === userId && (!cycleId || x.cycleId === cycleId)).sort((a, b) => b.conductedAt.localeCompare(a.conductedAt)) };
  }
  const score = Number(body.score);
  const badScore = body.score !== undefined && !(Number.isInteger(score) && score >= 1 && score <= 5);
  if (is('POST', /^\/admin\/mocks$/)) {
    if (!userById(db, body.userId) || !body.cycleId || !body.type || badScore || body.score === undefined) return err(400, 'BAD_REQUEST', 'Dados do mock inválidos');
    const now = new Date().toISOString();
    const mk = { id: db.newId('mock'), userId: body.userId, cycleId: body.cycleId, type: body.type, score, feedback: body.feedback ?? null, conductedBy: body.conductedBy ?? null, conductedAt: body.conductedAt ?? now, topics: body.topics ?? [], createdAt: now };
    mocks.push(mk);
    return { body: mk };
  }
  const mockId = path.match(/^\/admin\/mocks\/([^/]+)$/)?.[1];
  if (mockId) {
    const mk = mocks.find((x) => x.id === mockId);
    if (!mk) return err(404, 'NOT_FOUND', 'Mock não encontrado');
    if (method === 'PATCH') {
      if (badScore) return err(400, 'BAD_REQUEST', 'Nota entre 1 e 5');
      for (const k of ['type', 'feedback', 'conductedBy', 'conductedAt', 'topics']) if (body[k] !== undefined) mk[k] = body[k];
      if (body.score !== undefined) mk.score = score;
      return { body: mk };
    }
    if (method === 'DELETE') {
      mocks.splice(mocks.indexOf(mk), 1);
      return { body: { ok: true } };
    }
  }

  // ---------- notes ----------
  if (is('GET', /^\/admin\/notes$/)) {
    const aboutId = url.searchParams.get('aboutId');
    return { body: notes.filter((n) => n.aboutId === aboutId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  }
  if (is('POST', /^\/admin\/notes$/)) {
    const text = String(body.text ?? '').trim();
    if (!text || !body.aboutId) return err(400, 'BAD_REQUEST', 'Nota vazia');
    const n = { id: db.newId('note'), aboutId: body.aboutId, authorId: db.ADMIN.id, text, createdAt: new Date().toISOString() };
    notes.push(n);
    return { body: n };
  }
  const noteId = path.match(/^\/admin\/notes\/([^/]+)$/)?.[1];
  if (noteId) {
    const n = notes.find((x) => x.id === noteId);
    if (!n) return err(404, 'NOT_FOUND', 'Nota não encontrada');
    if (method === 'PATCH') {
      const text = String(body.text ?? '').trim();
      if (!text) return err(400, 'BAD_REQUEST', 'Nota vazia');
      n.text = text;
      return { body: n };
    }
    if (method === 'DELETE') {
      notes.splice(notes.indexOf(n), 1);
      return { body: { ok: true } };
    }
  }
  return undefined;
}
