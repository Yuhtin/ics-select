// Mock routes for the admin cycles list, roster, classes/attendance, plans overview,
// cycle receipt and the published-plan half of the plan editor.
// Plans live in db.plans (shared with the built-in editor routes); cycles other than
// db.CYCLE, alumni users and classes live here. Everything seeds on the first request.
import { existsSync } from 'node:fs';

const forbidden = { status: 403, body: { error: { code: 'FORBIDDEN', message: 'Somente admin' } } };
const err = (status, code, message, details) => ({ status, body: { error: { code, message, ...(details ? { details } : {}) } } });
// ponytail: admin-members.mjs sorts after this file, so it could never override us. Serve the
// member list only while that plugin doesn't exist.
const SERVE_DASHBOARD = !existsSync(new URL('./admin-members.mjs', import.meta.url));

let S = null;

// ---------- seed ----------
const ALUMNI = [
  ['u-marina', 'Marina Prado', 72],
  ['u-otavio', 'Otávio Reis', 58],
  ['u-paula', 'Paula Mendes', 64],
  ['u-rafael', 'Rafael Tanaka', 51],
  ['u-sofia', 'Sofia Brandão', 45],
];
// Items each member gets per week, cycling through the library in study order.
const TRACK_ORDER = ['lib-bigo', 'lib-tp', 'lib-lc1', 'lib-sw', 'lib-hash', 'lib-lc20', 'lib-lc3', 'lib-stack', 'lib-lc49', 'lib-trees', 'lib-mono', 'lib-lc104', 'lib-lc739', 'lib-grok', 'lib-lc42', 'lib-dijkstra'];

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

function boot(db) {
  if (S) return;
  const { DAY, ymd } = db.helpers;
  const monday = db.thisMonday;
  const users = new Map(db.MEMBERS.map((m) => [m.id, m]));
  for (const [id, name, score] of ALUMNI) users.set(id, { id, name, score, email: `${id.slice(2)}@inteli.edu.br` });

  const past = {
    id: 'c-2026-1',
    name: 'Ciclo 2026.1',
    startsAt: new Date(monday.getTime() - 20 * 7 * DAY).toISOString(),
    endsAt: new Date(monday.getTime() - 12 * 7 * DAY - 60_000).toISOString(),
    status: 'ARCHIVED',
    rankingVisibleToMembers: true,
    weeksTotal: 8,
    createdAt: new Date(monday.getTime() - 24 * 7 * DAY).toISOString(),
  };
  const next = {
    id: 'c-2027-1',
    name: 'Ciclo 2027.1',
    startsAt: new Date(monday.getTime() + 10 * 7 * DAY).toISOString(),
    endsAt: new Date(monday.getTime() + 18 * 7 * DAY - 60_000).toISOString(),
    status: 'ACTIVE',
    rankingVisibleToMembers: false,
    weeksTotal: 8,
    createdAt: new Date(monday.getTime() - 7 * DAY).toISOString(),
  };
  db.CYCLE.createdAt ??= new Date(new Date(db.CYCLE.startsAt).getTime() - 21 * DAY).toISOString();

  S = {
    users,
    cycles: [past, db.CYCLE, next],
    // Roster of every cycle except db.CYCLE, whose roster is db.MEMBERS itself.
    rosters: new Map([
      [past.id, new Set(['u-bruno', 'u-carla', 'u-marina', 'u-otavio', 'u-paula', 'u-rafael'])],
      [next.id, new Set()],
    ]),
    classes: [],
  };
  db.adminCycles = S; // shared with admin-members.mjs (past cycles, alumni, attendance)

  // Classes of the active cycle: two held (with attendance), one upcoming.
  const cls = (i, title, topic, weekOffset, notes) => ({
    id: `cls-${i}`,
    cycleId: db.CYCLE.id,
    title,
    topic,
    scheduledAt: db.helpers.atDay(monday, weekOffset * 7 + 2, 19, 30).toISOString(),
    durationMin: 90,
    notes,
    attendances: [],
  });
  S.classes.push(
    cls(1, 'Aula 1 · Big-O e Two Pointers', 'arrays', -2, 'Abertura do ciclo.'),
    cls(2, 'Aula 2 · Hashing na prática', 'hashing', -1, null),
    cls(3, 'Aula 3 · Stacks e monotonic stack', 'stack', 1, null),
  );
  const r = rng(11);
  for (const c of S.classes.slice(0, 2)) {
    c.attendances = db.MEMBERS.map((m) => ({ userId: m.id, status: r() > 0.85 ? 'ABSENT' : r() > 0.8 ? 'LATE' : 'PRESENT' }));
  }

  // Published plans: weeks 1–2 of the active cycle for everyone, week 3 for everyone but
  // Ana (her week-3 plan is db.anaPlan). The past cycle gets 8 weeks for its roster.
  const seedPlans = (cycleId, memberIds, weekMondays, scoreOf) => {
    memberIds.forEach((uid, mi) => {
      weekMondays.forEach((wk, wi) => {
        const planId = `plan-${uid.slice(2)}-${ymd(wk)}`;
        if (db.plans.has(planId)) return;
        const isCurrent = wk.getTime() === monday.getTime();
        const score = scoreOf(uid);
        const plan = { id: planId, userId: uid, cycleId, weekStart: ymd(wk), status: 'PUBLISHED', adminNotes: null, items: [] };
        for (let k = 0; k < 4; k++) {
          const lib = TRACK_ORDER[(wi * 3 + k + mi) % TRACK_ORDER.length];
          if (!db.libById.has(lib) || plan.items.some((i) => i.libId === lib)) continue;
          const dayOffset = Math.round((wk - monday) / DAY) + Math.min(4, k + (k > 1 ? 1 : 0));
          const due = new Date(db.helpers.atDay(monday, dayOffset, 19)).getTime() < Date.now();
          const roll = r() * 100;
          const outcome = !due
            ? 'PENDING'
            : roll < score * 0.7 ? 'DONE_EASY' : roll < score ? 'DONE_HARD' : roll < score + 8 ? 'DOUBTS' : roll < score + 16 ? 'STUCK' : isCurrent ? 'PENDING' : 'SKIPPED';
          plan.items.push(db.planItem(planId, lib, k, dayOffset, 19, 0, outcome));
        }
        db.plans.set(planId, plan);
      });
    });
  };
  const w = (n) => new Date(new Date(db.CYCLE.startsAt).getTime() + n * 7 * DAY);
  const liveScore = (uid) => (uid === db.ME ? 80 : db.scoreOf(users.get(uid)));
  seedPlans(db.CYCLE.id, db.MEMBERS.map((m) => m.id), [w(0), w(1)], liveScore);
  seedPlans(db.CYCLE.id, db.MEMBERS.filter((m) => m.id !== db.ME).map((m) => m.id), [w(2)], liveScore);
  db.anaPlan.cycleId = db.CYCLE.id;
  const pastWeeks = Array.from({ length: 8 }, (_, k) => new Date(new Date(past.startsAt).getTime() + k * 7 * DAY));
  seedPlans(past.id, [...S.rosters.get(past.id)], pastWeeks, (uid) => users.get(uid).score + 10);

  // A couple of next-week drafts so the plans overview shows both states.
  for (const uid of ['u-bruno', 'u-elisa']) {
    const d = getOrCreate(db, uid, ymd(new Date(monday.getTime() + 7 * DAY)));
    d.items = ['lib-mono', 'lib-lc739'].map((lib, order) => db.planItem(d.id, lib, order, null, 0));
  }
}

// ---------- helpers ----------
const cycleById = (id) => S.cycles.find((c) => c.id === id);
const rosterOf = (db, c) => (c.id === db.CYCLE.id ? db.MEMBERS.map((m) => m.id) : [...(S.rosters.get(c.id) ?? [])]);
const userDto = (id) => {
  const u = S.users.get(id);
  return { userId: id, name: u?.name ?? 'Membro', pictureUrl: null };
};
const weeksTotal = (c) => Math.max(1, Math.ceil((new Date(c.endsAt) - new Date(c.startsAt)) / (7 * 86_400_000)));
function weekNumberOf(c, now = new Date()) {
  if (now < new Date(c.startsAt)) return 0;
  return Math.min(weeksTotal(c), Math.floor((now - new Date(c.startsAt)) / (7 * 86_400_000)) + 1);
}
const cycleRow = (db, c) => ({
  id: c.id, name: c.name, startsAt: c.startsAt, endsAt: c.endsAt, status: c.status,
  rankingVisibleToMembers: c.rankingVisibleToMembers, createdAt: c.createdAt,
  _count: { memberships: rosterOf(db, c).length },
});

// Mirrors lib/cycle/active-cycle.ts: running ACTIVE cycle (largest roster first), else nearest upcoming.
function activeCycle(db) {
  const now = Date.now();
  const active = S.cycles.filter((c) => c.status === 'ACTIVE');
  const running = active
    .filter((c) => new Date(c.startsAt) <= now && now <= new Date(c.endsAt))
    .sort((a, b) => rosterOf(db, b).length - rosterOf(db, a).length || a.startsAt.localeCompare(b.startsAt));
  if (running[0]) return running[0];
  return active.filter((c) => new Date(c.startsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
}

const planCycleId = (db, p) => p.cycleId ?? db.CYCLE.id;
const plansOf = (db, userId) => [...db.plans.values()].filter((p) => p.userId === userId);
const weekEndIso = (db, weekStart) => new Date(new Date(`${weekStart}T00:00:00`).getTime() + 7 * db.helpers.DAY - 1).toISOString();

function planDto(db, p) {
  return {
    ...db.weeklyPlanDto(p),
    cycleId: planCycleId(db, p),
    publishAt: p.publishAt ?? null,
    sendWhatsapp: p.sendWhatsapp ?? true,
    autoSchedule: p.autoSchedule ?? true,
  };
}

function getOrCreate(db, memberId, weekStart) {
  const existing = plansOf(db, memberId).find((p) => p.weekStart === weekStart);
  if (existing) return existing;
  const draft = { id: `plan-${memberId.slice(2)}-${weekStart}`, userId: memberId, cycleId: db.CYCLE.id, weekStart, status: 'DRAFT', adminNotes: null, items: [] };
  db.plans.set(draft.id, draft);
  db.draftByMember.set(memberId, draft);
  return draft;
}

// ---------- scheduler (same contract as apps/api/src/scheduler/phase1.ts, minus chunking) ----------
// Days before today (and before `fromDay`) are closed; `taken` holds minutes already
// booked per weekday. Strict order by default; relax = biggest-first first-fit.
function place(db, weekStartYmd, items, { relax = false, force = false, taken = [0, 0, 0, 0, 0, 0, 0] } = {}) {
  const { AVAILABILITY } = db;
  const { DAY, atDay, startOfDay } = db.helpers;
  const weekStart = new Date(`${weekStartYmd}T00:00:00`);
  const today = Math.round((startOfDay(new Date()) - weekStart) / DAY);
  const firstDay = Math.max(0, today + (new Date().getHours() >= AVAILABILITY.startHour ? 1 : 0));
  const used = [...taken];
  const open = (d) => (d < firstDay ? 0 : AVAILABILITY.perDay[d]);
  const placements = [];
  const overflow = [];
  const put = (it, d) => {
    placements.push({ itemId: it.id, scheduledAt: atDay(weekStart, d, AVAILABILITY.startHour, used[d]).toISOString(), durationMinutes: it.minutes });
    used[d] += it.minutes;
  };
  const queue = relax ? [...items].sort((a, b) => b.minutes - a.minutes) : [...items].sort((a, b) => a.order - b.order);
  let cursor = firstDay;
  for (const it of queue) {
    let d = relax ? firstDay : cursor;
    while (d < 7 && used[d] + it.minutes > open(d)) d += 1;
    if (d < 7) {
      put(it, d);
      if (!relax) cursor = d;
    } else overflow.push({ itemId: it.id, minutesRequired: it.minutes });
  }
  if (force && overflow.length > 0) {
    // Forced publish ignores declared availability: stack leftovers on the last open day.
    const last = [6, 5, 4, 3, 2, 1, 0].find((d) => d >= firstDay && AVAILABILITY.perDay[d] > 0) ?? Math.min(6, firstDay);
    for (const o of overflow.splice(0)) put(items.find((i) => i.id === o.itemId), last);
  }
  return { placements, overflow };
}

const asSchedItem = (db, i) => ({ id: i.id, order: i.order, minutes: db.allocated(db.libById.get(i.libId)) });
function bookedByDay(db, plan, exclude) {
  const taken = [0, 0, 0, 0, 0, 0, 0];
  const ws = new Date(`${plan.weekStart}T00:00:00`);
  for (const i of plan.items) {
    if (exclude.has(i.id) || !i.scheduledAt || i.outcome === 'SKIPPED') continue;
    const d = Math.floor((new Date(i.scheduledAt) - ws) / db.helpers.DAY);
    if (d >= 0 && d < 7) taken[d] += i.scheduledMinutes ?? 0;
  }
  return taken;
}
function apply(plan, r) {
  const byId = new Map(r.placements.map((p) => [p.itemId, p]));
  for (const i of plan.items) {
    const p = byId.get(i.id);
    if (p) {
      i.scheduledAt = p.scheduledAt;
      i.scheduledMinutes = p.durationMinutes;
    } else if (r.overflow.some((o) => o.itemId === i.id)) {
      i.scheduledAt = null;
      i.scheduledMinutes = null;
    }
  }
}
const overflowErr = (overflow) => err(409, 'PLAN_OVERFLOW', `${overflow.length} item(ns) não couberam na agenda`, { overflow });

// ---------- plan context (adds memberHistory, retro, coverage, slots to the built-in) ----------
const RETROS = {
  'u-ana': { whatClicked: 'Two pointers finalmente fez sentido quando desenhei os índices no papel.', whatStuck: 'Trapping Rain Water: não entendi por que o menor máximo decide.', nextWeekWish: 'Mais problemas de stack, estou curtindo.' },
  'u-lucas': { whatClicked: null, whatStuck: 'Dijkstra com fila de prioridade ainda está nebuloso.', nextWeekWish: 'Revisar grafos antes de avançar.' },
  'u-carla': { whatClicked: 'Hash maps por dentro abriu minha cabeça.', whatStuck: null, nextWeekWish: null },
};

function planContext(db, memberId, weekStart) {
  const { DAY, ymd, startOfDay } = db.helpers;
  const m = S.users.get(memberId);
  const prevStart = ymd(new Date(new Date(`${weekStart}T00:00:00`).getTime() - 7 * DAY));
  const prev = plansOf(db, memberId).find((p) => p.weekStart === prevStart && p.status === 'PUBLISHED');
  const lib = (i) => db.libById.get(i.libId);
  const count = (o) => prev?.items.filter((i) => i.outcome === o).length ?? 0;

  const history = new Map();
  const coverage = new Map();
  for (const p of plansOf(db, memberId).sort((a, b) => a.weekStart.localeCompare(b.weekStart))) {
    for (const i of p.items) {
      const l = lib(i);
      if (!l) continue;
      if (i.outcome !== 'PENDING') history.set(l.id, i.outcome);
      const c = coverage.get(l.topic.id) ?? { topicId: l.topic.id, topicSlug: l.topic.slug, topicLabel: l.topic.label, order: l.topic.order, itemsPlanned: 0, itemsDone: 0 };
      c.itemsPlanned += 1;
      if (db.isPositive(i.outcome)) c.itemsDone += 1;
      coverage.set(l.topic.id, c);
    }
  }
  const available = (tid) => db.LIB.filter((l) => l.topic.id === tid).length;

  const [mon, tue, wed, thu, fri, sat, sun] = db.AVAILABILITY.perDay;
  const ws = new Date(`${weekStart}T00:00:00`);
  const todayIdx = Math.round((startOfDay(new Date()) - ws) / DAY);
  const openDays = db.AVAILABILITY.perDay.map((cap, d) => (d >= todayIdx ? cap : 0));
  const retro = prev && RETROS[memberId] ? { ...RETROS[memberId], submittedAt: new Date(ws.getTime() - 2 * DAY).toISOString(), valuedItem: null, stuckItem: null } : null;

  return {
    member: { id: memberId, name: m?.name ?? 'Membro', pictureUrl: null, track: 'BIG_TECH' },
    cycle: { id: db.CYCLE.id, name: db.CYCLE.name, weekNumber: weekNumberOf(db.CYCLE, ws), weeksTotal: db.CYCLE.weeksTotal },
    lastWeek: {
      weekStart: prev ? prevStart : null,
      outcomes: { done_easy: count('DONE_EASY'), done_hard: count('DONE_HARD'), doubts: count('DOUBTS'), stuck: count('STUCK'), skipped: count('SKIPPED'), pending: count('PENDING') },
      items: (prev?.items ?? []).map((i) => ({ id: i.id, libraryItemId: i.libId, title: lib(i).title, outcome: i.outcome, reflection: i.reflection })),
    },
    // Carry-over scope is PENDING + STUCK only (CLAUDE.md), same as PlanDraftsService.
    carryOverCandidates: (prev?.items ?? [])
      .filter((i) => i.outcome === 'PENDING' || i.outcome === 'STUCK')
      .map((i) => ({ id: i.id, libraryItemId: i.libId, title: lib(i).title, outcome: i.outcome, reflection: i.reflection, topicId: lib(i).topic.id, topicLabel: lib(i).topic.label, estimatedMinutes: lib(i).estimatedMinutes })),
    retro,
    topicCoverage: [...coverage.values()]
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ ...c, itemsAvailable: available(c.topicId), coveragePct: Math.round((c.itemsDone / Math.max(1, available(c.topicId))) * 100) })),
    availability: {
      mondayMinutes: mon, tuesdayMinutes: tue, wednesdayMinutes: wed, thursdayMinutes: thu,
      fridayMinutes: fri, saturdayMinutes: sat, sundayMinutes: sun,
      preferredSessionMinutes: 45,
      weeklyBudgetMinutes: db.AVAILABILITY.perDay.reduce((s, x) => s + x, 0),
      timezone: 'America/Sao_Paulo',
      remainingCapacityMinutes: openDays.reduce((s, x) => s + x, 0),
      daysRemaining: openDays.filter((x) => x > 0).length,
      slots: db.AVAILABILITY.perDay.flatMap((cap, d) => (cap > 0 ? [{ dayOfWeek: d, startMinute: db.AVAILABILITY.startHour * 60, endMinute: db.AVAILABILITY.startHour * 60 + cap }] : [])),
      busyBlocks: [],
    },
    memberHistory: [...history].map(([libraryItemId, lastOutcome]) => ({ libraryItemId, lastOutcome })),
  };
}

// ---------- AI draft (alternates + per-item rationale + brief) ----------
function aiDraft(db, body) {
  const ctx = planContext(db, body.memberId, String(body.weekStart).slice(0, 10));
  const carryIds = new Set(body.carryOverItemIds ?? []);
  const carry = ctx.carryOverCandidates.filter((c) => carryIds.has(c.id)).map((c) => c.libraryItemId);
  const mastered = new Set(ctx.memberHistory.filter((h) => ['DONE_EASY', 'DONE_HARD', 'SKIPPED'].includes(h.lastOutcome)).map((h) => h.libraryItemId));
  const brief = String(body.briefText ?? '').toLowerCase();
  const wantsVideo = /v[íi]deo/.test(brief);
  const fresh = db.LIB.filter((l) => !mastered.has(l.id) && !carry.includes(l.id))
    .sort((a, b) => (wantsVideo ? (b.format === 'VIDEO') - (a.format === 'VIDEO') : 0) || a.topic.order - b.topic.order || a.estimatedMinutes - b.estimatedMinutes);
  const picks = [...carry, ...fresh.slice(0, 5 - Math.min(carry.length, 3)).map((l) => l.id)].slice(0, 5);
  const alternates = fresh.map((l) => l.id).filter((id) => !picks.includes(id)).slice(0, 3);
  const first = ctx.member.name.split(' ')[0];
  const why = (id) => {
    const l = db.libById.get(id);
    if (carry.includes(id)) return 'Ficou pendente na semana passada; retomar antes de abrir tópico novo.';
    if (l.format === 'PROBLEM') return `Prática de ${l.topic.label} logo depois da base conceitual.`;
    return `Base conceitual de ${l.topic.label}, porta de entrada da escada fácil → difícil.`;
  };
  return {
    draft: {
      items: picks.map((id, order) => ({ libraryItemId: id, order, rationale: why(id) })),
      alternates: alternates.map((id) => ({ libraryItemId: id, rationale: `Alternativa em ${db.libById.get(id).topic.label} se ${first} render mais que o esperado.` })),
      narrative: `${first} retoma ${carry.length} ${carry.length === 1 ? 'item' : 'itens'} de carry-over e avança pela ordem do acervo, conceito antes de prática.${brief ? ` Direção aplicada: "${body.briefText}".` : ''}`,
      totalMinutes: picks.reduce((s, id) => s + db.libById.get(id).estimatedMinutes, 0),
    },
    usage: { model: 'mock', costUsd: 0 },
  };
}

// ---------- overview for cycles other than db.CYCLE ----------
function simpleOverview(db, c) {
  const ids = rosterOf(db, c);
  const pct = (uid) => {
    const items = plansOf(db, uid).filter((p) => planCycleId(db, p) === c.id).flatMap((p) => p.items);
    return items.length ? Math.round((items.filter((i) => db.isPositive(i.outcome)).length / items.length) * 100) : 0;
  };
  return {
    cycle: { id: c.id, name: c.name, startsAt: c.startsAt, endsAt: c.endsAt, status: c.status, rankingVisibleToMembers: c.rankingVisibleToMembers, weekNumber: weekNumberOf(c), weeksTotal: weeksTotal(c) },
    members: ids.map((uid) => ({ ...userDto(uid), track: 'BIG_TECH', percentThisWeek: pct(uid), done: 0, total: 0, hasAlert: false, availability: { itemsCount: 0, plannedMinutes: 0, budgetMinutes: 300 } })),
    heatmap: { weeks: [], rows: [] },
    feed: [],
    ranking: [],
  };
}

// ---------- receipt ----------
function receipt(db, c, asOfParam) {
  const { DAY, ymd, startOfDay } = db.helpers;
  const now = new Date();
  if (new Date(c.startsAt) > now) return err(409, 'CYCLE_NOT_STARTED', 'Ciclo ainda não começou');
  const end = new Date(c.endsAt) < now ? new Date(c.endsAt) : now;
  let asOf = end;
  if (asOfParam) {
    asOf = new Date(`${asOfParam}T23:59:00`);
    if (Number.isNaN(asOf.getTime()) || asOfParam < ymd(c.startsAt) || asOfParam > ymd(end)) return err(400, 'INVALID_AS_OF', 'Data fora do ciclo');
    if (asOf > end) asOf = end;
  }
  const ids = rosterOf(db, c);
  const score = (uid) => (db.memberById.has(uid) && c.id === db.CYCLE.id ? db.scoreOf(db.memberById.get(uid)) : S.users.get(uid)?.score ?? 50);
  const done = ids.flatMap((uid) =>
    plansOf(db, uid)
      .filter((p) => planCycleId(db, p) === c.id)
      .flatMap((p) => p.items)
      .filter((i) => db.isPositive(i.outcome) && i.outcome !== 'SKIPPED' && i.completedAt && new Date(i.completedAt) <= asOf)
      .map((i) => ({ uid, lib: db.libById.get(i.libId), at: new Date(i.completedAt), stuckOrDoubts: i.outcome === 'DOUBTS' })),
  ).filter((d) => d.lib);
  const per = new Map(ids.map((uid) => [uid, done.filter((d) => d.uid === uid)]));
  const minutesOf = (list) => list.reduce((s, d) => s + d.lib.estimatedMinutes, 0);
  const days = (list) => new Set(list.map((d) => ymd(d.at))).size;
  const topicsOf = (list) => [...new Set(list.map((d) => d.lib.topic.label))];
  const best = (fn) => {
    const [uid] = [...per].sort((a, b) => fn(b[1]) - fn(a[1]) || userDto(a[0]).name.localeCompare(userDto(b[0]).name))[0] ?? [];
    return uid && fn(per.get(uid)) > 0 ? { ...userDto(uid), value: fn(per.get(uid)), uid } : null;
  };

  const classes = S.classes.filter((k) => k.cycleId === c.id);
  const held = classes.filter((k) => new Date(k.scheduledAt) < asOf);
  const present = held.flatMap((k) => k.attendances.filter((a) => a.status === 'PRESENT'));
  const topics = [...new Map(done.map((d) => [d.lib.topic.id, d.lib.topic])).values()].sort((a, b) => a.order - b.order);
  const byTopic = topics.map((t) => {
    const reached = new Set(done.filter((d) => d.lib.topic.id === t.id).map((d) => d.uid));
    return { topicId: t.id, slug: t.slug, label: t.label, order: t.order, membersReached: reached.size, itemsCompleted: done.filter((d) => d.lib.topic.id === t.id).length, coveragePct: ids.length ? reached.size / ids.length : 0 };
  });
  const lastWeek = (list) => list.filter((d) => d.at > new Date(asOf.getTime() - 7 * DAY)).length;
  const movers = [...per].map(([uid, list]) => ({ ...userDto(uid), deltaItems: lastWeek(list), topTopics: topicsOf(list.filter((d) => d.at > new Date(asOf.getTime() - 7 * DAY))).slice(0, 3) }))
    .filter((m) => m.deltaItems > 0).sort((a, b) => b.deltaItems - a.deltaItems).slice(0, 3);
  const cycleMover = best((l) => l.length);
  const marathon = [...per].map(([uid, list]) => {
    const byDay = new Map();
    for (const d of list) byDay.set(ymd(d.at), (byDay.get(ymd(d.at)) ?? 0) + 1);
    const [date, items] = [...byDay].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    return { ...userDto(uid), date, items };
  }).sort((a, b) => b.items - a.items)[0];
  const longest = [...done].sort((a, b) => b.lib.estimatedMinutes - a.lib.estimatedMinutes)[0];
  const ranking = ids.map((uid) => ({ ...userDto(uid), score: score(uid) })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const strip = (b, key) => (b ? { userId: b.userId, name: b.name, pictureUrl: null, [key]: b.value } : null);
  const totalMinutes = minutesOf(done);
  const asOfKey = ymd(asOf);

  return {
    body: {
      cycle: { id: c.id, name: c.name, weekNumber: weekNumberOf(c, asOf), weeksTotal: weeksTotal(c), startsAt: c.startsAt, endsAt: c.endsAt, status: c.status },
      asOf: asOf.toISOString(),
      mode: c.status === 'ARCHIVED' || asOfKey === ymd(c.endsAt) ? 'wrapped' : 'thermal',
      totals: {
        members: ids.length, totalMinutes, avgMinutesPerMember: ids.length ? Math.round(totalMinutes / ids.length) : 0,
        itemsCompleted: done.length,
        retros: Math.round(Math.max(0, weekNumberOf(c, asOf) - 1) * ids.length * 0.7),
        classesHeld: held.length, classesTotal: classes.length,
        attendanceRate: held.length && ids.length ? present.length / (held.length * ids.length) : 0,
      },
      byTopic,
      knowledgeGrid: {
        members: ids.map(userDto),
        topics: topics.map((t) => ({ topicId: t.id, slug: t.slug, label: t.label, order: t.order })),
        cells: ids.flatMap((uid) => topics.map((t) => {
          const list = per.get(uid).filter((d) => d.lib.topic.id === t.id);
          return { userId: uid, topicId: t.id, itemsDone: list.length, hasStuckOrDoubts: list.some((d) => d.stuckOrDoubts) };
        })),
      },
      topMovers: movers,
      cycleTopMover: cycleMover ? { userId: cycleMover.userId, name: cycleMover.name, pictureUrl: null, deltaItems: cycleMover.value, topTopics: topicsOf(per.get(cycleMover.uid)).slice(0, 3) } : null,
      engagementRanking: ranking,
      streakChampion: strip(best((l) => Math.min(days(l), 12)), 'streakDays'),
      engagementLeader: ranking[0] ?? null,
      mostHoursStudied: strip(best(minutesOf), 'minutes'),
      mostItemsCompleted: strip(best((l) => l.length), 'items'),
      polymath: strip(best((l) => topicsOf(l).length), 'topics'),
      mostActiveDays: strip(best(days), 'days'),
      marathonDay: marathon && marathon.items > 1 ? marathon : null,
      longestItem: longest ? { ...userDto(longest.uid), itemTitle: longest.lib.title, minutes: longest.lib.estimatedMinutes } : null,
      perfectAttendance: held.length ? ids.filter((uid) => held.every((k) => k.attendances.some((a) => a.userId === uid && a.status === 'PRESENT'))).map(userDto) : [],
    },
  };
}

// ---------- routes ----------
export default async function ({ url, role, body, path, method, db }) {
  boot(db); // unconditional so other plugins see db.adminCycles on any first request
  const mine =
    /^\/cycles(\/|$)/.test(path) || /^\/classes\//.test(path) || /^\/admin\/cycles?\//.test(path) ||
    /^\/plans\/[^/]+(\/(publish|auto-schedule|edit|reschedule-pending|preview-scheduling))?$/.test(path) ||
    /^\/admin\/member\/[^/]+\/plan-(drafts|context)$/.test(path) || path === '/ai/draft-plan' ||
    (SERVE_DASHBOARD && path === '/admin/dashboard');
  if (!mine) return undefined;
  if (role !== 'admin') {
    // Members still read their own plans through GET /plans/:id and auto-schedule.
    if (/^\/plans\//.test(path) && (method === 'GET' || path.endsWith('/auto-schedule'))) return undefined;
    return role ? forbidden : err(401, 'UNAUTHORIZED', 'Faça login no mock');
  }
  const { DAY, ymd } = db.helpers;

  // --- cycles ---
  if (method === 'GET' && path === '/cycles') return { body: S.cycles.map((c) => cycleRow(db, c)) };
  if (method === 'POST' && path === '/cycles') {
    const name = String(body.name ?? '').trim();
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (!name) return err(400, 'VALIDATION', 'Nome obrigatório');
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return err(400, 'VALIDATION', 'O fim precisa ser depois do início');
    const c = { id: `c-${Date.now().toString(36)}`, name, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), status: 'ACTIVE', rankingVisibleToMembers: false, createdAt: new Date().toISOString() };
    c.weeksTotal = weeksTotal(c);
    S.cycles.push(c);
    S.rosters.set(c.id, new Set());
    return { body: cycleRow(db, c) };
  }
  const archive = path.match(/^\/cycles\/([^/]+)\/archive$/);
  if (method === 'POST' && archive) {
    const c = cycleById(archive[1]);
    if (!c) return err(404, 'NOT_FOUND', 'Ciclo não encontrado');
    c.status = 'ARCHIVED';
    return { body: cycleRow(db, c) };
  }
  const patchCycle = path.match(/^\/cycles\/([^/]+)$/);
  if (method === 'PATCH' && patchCycle) {
    const c = cycleById(patchCycle[1]);
    if (!c) return err(404, 'NOT_FOUND', 'Ciclo não encontrado');
    if (typeof body.rankingVisibleToMembers === 'boolean') c.rankingVisibleToMembers = body.rankingVisibleToMembers;
    if (typeof body.name === 'string' && body.name.trim()) c.name = body.name.trim();
    return { body: cycleRow(db, c) };
  }

  // --- roster ---
  const addMember = path.match(/^\/cycles\/([^/]+)\/members$/);
  if (method === 'POST' && addMember) {
    const c = cycleById(addMember[1]);
    const u = S.users.get(body.userId);
    if (!c || !u) return err(404, 'NOT_FOUND', 'Ciclo ou membro não encontrado');
    if (rosterOf(db, c).includes(u.id)) return err(409, 'CONFLICT', `${u.name} já está neste ciclo.`);
    const ends = (x) => new Date(x.endsAt);
    const starts = (x) => new Date(x.startsAt);
    const clash = S.cycles.find((o) => o.id !== c.id && o.status === 'ACTIVE' && rosterOf(db, o).includes(u.id) && starts(o) <= ends(c) && starts(c) <= ends(o));
    if (clash) return err(409, 'CONFLICT', `${u.name} já está no ${clash.name}, que se sobrepõe a este ciclo.`);
    if (c.id === db.CYCLE.id) {
      if (!db.MEMBERS.some((m) => m.id === u.id)) db.MEMBERS.push(u);
      db.memberById.set(u.id, u);
    } else S.rosters.get(c.id).add(u.id);
    return { body: { id: `ms-${c.id}-${u.id}`, userId: u.id, cycleId: c.id } };
  }
  const removeMember = path.match(/^\/cycles\/([^/]+)\/members\/([^/]+)$/);
  if (method === 'DELETE' && removeMember) {
    const [, cid, uid] = removeMember;
    if (cid === db.CYCLE.id) {
      const idx = db.MEMBERS.findIndex((m) => m.id === uid);
      if (idx >= 0) db.MEMBERS.splice(idx, 1); // memberById keeps them so old feed rows still resolve
      return { body: { count: idx >= 0 ? 1 : 0 } };
    }
    return { body: { count: S.rosters.get(cid)?.delete(uid) ? 1 : 0 } };
  }
  if (SERVE_DASHBOARD && method === 'GET' && path === '/admin/dashboard') {
    const stats = (uid) => {
      const items = plansOf(db, uid).flatMap((p) => p.items);
      return { plansCount: plansOf(db, uid).length, doneItems: items.filter((i) => db.isPositive(i.outcome) && i.outcome !== 'SKIPPED').length, skippedItems: items.filter((i) => i.outcome === 'SKIPPED').length, stuckItems: items.filter((i) => i.outcome === 'STUCK').length };
    };
    return {
      body: [
        { id: db.ADMIN.id, name: db.ADMIN.name, email: db.ADMIN.email, pictureUrl: null, role: 'ADMIN', stats: { plansCount: 0, doneItems: 0, skippedItems: 0, stuckItems: 0 } },
        ...[...S.users.values()].map((u) => ({ id: u.id, name: u.name, email: u.email, pictureUrl: null, role: 'MEMBER', stats: stats(u.id) })),
      ],
    };
  }

  // --- classes ---
  const classes = path.match(/^\/cycles\/([^/]+)\/classes$/);
  if (classes && method === 'GET') return { body: S.classes.filter((k) => k.cycleId === classes[1]) };
  if (classes && method === 'POST') {
    if (!String(body.title ?? '').trim() || Number.isNaN(new Date(body.scheduledAt).getTime())) return err(400, 'VALIDATION', 'Título e data são obrigatórios');
    const k = { id: `cls-${Date.now().toString(36)}`, cycleId: classes[1], title: body.title.trim(), topic: body.topic || null, scheduledAt: new Date(body.scheduledAt).toISOString(), durationMin: Number(body.durationMin) || 90, notes: body.notes ?? null, attendances: [] };
    S.classes.push(k);
    return { body: k };
  }
  const attendance = path.match(/^\/classes\/([^/]+)\/attendance$/);
  if (attendance && method === 'POST') {
    const k = S.classes.find((x) => x.id === attendance[1]);
    if (!k) return err(404, 'NOT_FOUND', 'Aula não encontrada');
    k.attendances = (body.rows ?? []).map((r) => ({ userId: r.userId, status: r.status }));
    return { body: { ok: true, count: k.attendances.length } };
  }

  // --- admin cycle overview / receipt / plans overview ---
  if (method === 'GET' && path === '/admin/cycle/active') {
    const c = activeCycle(db);
    if (!c) return err(404, 'NOT_FOUND', 'Nenhum ciclo ativo');
    return c.id === db.CYCLE.id ? undefined : { body: simpleOverview(db, c) };
  }
  const receiptMatch = path.match(/^\/admin\/cycle\/([^/]+)\/receipt$/);
  if (method === 'GET' && receiptMatch) {
    const c = cycleById(receiptMatch[1]);
    return c ? receipt(db, c, url.searchParams.get('asOf')) : err(404, 'NOT_FOUND', 'Ciclo não encontrado');
  }
  const overview = path.match(/^\/admin\/cycle\/([^/]+)$/);
  if (method === 'GET' && overview) {
    if (overview[1] === db.CYCLE.id) return undefined; // built-in overview
    const c = cycleById(overview[1]);
    return c ? { body: simpleOverview(db, c) } : err(404, 'NOT_FOUND', 'Ciclo não encontrado');
  }
  const plansOverview = path.match(/^\/admin\/cycles\/([^/]+)\/plans$/);
  if (method === 'GET' && plansOverview) {
    const c = cycleById(plansOverview[1]);
    if (!c) return err(404, 'NOT_FOUND', 'Ciclo não encontrado');
    const status = url.searchParams.get('status') ?? 'all';
    const plans = [...db.plans.values()].filter(
      (p) => planCycleId(db, p) === c.id && (status === 'all' || (status === 'draft' ? p.status === 'DRAFT' : p.status === 'PUBLISHED')),
    );
    const weeks = [...new Set(plans.map((p) => p.weekStart))].sort().reverse().map((wk) => ({
      weekStart: new Date(`${wk}T00:00:00`).toISOString(),
      weekEnd: weekEndIso(db, wk),
      plans: plans
        .filter((p) => p.weekStart === wk)
        .map((p) => ({
          id: p.id,
          status: p.status,
          lastActivityAt: p.publishedAt ?? p.items.map((i) => i.completedAt).filter(Boolean).sort().pop() ?? new Date(`${wk}T00:00:00`).toISOString(),
          items: { total: p.items.length, done: p.items.filter((i) => db.isPositive(i.outcome)).length },
          user: { id: p.userId, name: S.users.get(p.userId)?.name ?? 'Membro', pictureUrl: null },
        }))
        .sort((a, b) => a.user.name.localeCompare(b.user.name)),
    }));
    return { body: { cycle: { id: c.id, name: c.name, startsAt: c.startsAt, endsAt: c.endsAt, weekNumber: weekNumberOf(c), weeksTotal: weeksTotal(c) }, weeks } };
  }

  // --- plan editor ---
  const drafts = path.match(/^\/admin\/member\/([^/]+)\/plan-drafts$/);
  if (method === 'POST' && drafts) {
    if (!S.users.has(drafts[1])) return err(404, 'NOT_FOUND', 'Membro não encontrado');
    const weekStart = body.weekStart ? ymd(new Date(`${String(body.weekStart).slice(0, 10)}T00:00:00`)) : ymd(new Date(db.thisMonday.getTime() + 7 * DAY));
    const wsDate = new Date(`${weekStart}T00:00:00`);
    if (body.weekStart && (wsDate < new Date(db.CYCLE.startsAt) || new Date(wsDate.getTime() + 7 * DAY - 1) > new Date(db.CYCLE.endsAt))) {
      return err(400, 'WEEK_OUTSIDE_CYCLE', 'Semana fora do ciclo');
    }
    return { body: planDto(db, getOrCreate(db, drafts[1], weekStart)) };
  }
  const ctx = path.match(/^\/admin\/member\/([^/]+)\/plan-context$/);
  if (method === 'GET' && ctx) {
    const ws = (url.searchParams.get('weekStart') ?? ymd(db.thisMonday)).slice(0, 10);
    return { body: planContext(db, ctx[1], ws) };
  }
  if (method === 'POST' && path === '/ai/draft-plan') {
    await db.helpers.sleep(1200);
    return { body: aiDraft(db, body) };
  }

  const pm = path.match(/^\/plans\/([^/]+)(?:\/([a-z-]+))?$/);
  const plan = pm && db.plans.get(pm[1]);
  if (!pm) return undefined;
  if (!plan) return err(404, 'NOT_FOUND', 'Plano não encontrado');
  const action = pm[2] ?? '';
  const pending = () => plan.items.filter((i) => i.outcome === 'PENDING');

  if (method === 'GET' && action === '') return { body: planDto(db, plan) };
  if (method === 'DELETE' && action === '') {
    db.plans.delete(plan.id);
    if (db.draftByMember.get(plan.userId) === plan) db.draftByMember.delete(plan.userId);
    if (plan === db.anaPlan) plan.items.splice(0); // the member home reads anaPlan directly
    return { status: 204, body: undefined };
  }
  if (method === 'PATCH' && action === '') {
    if (plan.status !== 'DRAFT' && plan.status !== 'SCHEDULED') return err(409, 'CONFLICT', 'Plano já publicado: use a edição de plano publicado');
    if (Array.isArray(body.items)) {
      const keep = new Map(plan.items.map((i) => [i.libId, i]));
      plan.items = body.items
        .filter((x) => db.libById.has(x.libraryItemId))
        .map((x) => Object.assign(keep.get(x.libraryItemId) ?? db.planItem(plan.id, x.libraryItemId, 0, null, 0), { order: x.order }));
    }
    if (body.adminNotes !== undefined) plan.adminNotes = body.adminNotes;
    return { body: planDto(db, plan) };
  }
  if (method === 'POST' && action === 'preview-scheduling') {
    const items = (body.items ?? []).map((i) => ({ id: i.libraryItemId, order: i.order, minutes: i.estimatedMinutes }));
    const r = place(db, plan.weekStart, items, { relax: body.relaxOrder === true });
    return { body: { ...r, busyBlocks: body.busyBlocks ?? [], weekStart: plan.weekStart, weekEnd: weekEndIso(db, plan.weekStart) } };
  }
  if (method === 'POST' && action === 'publish') {
    if (plan.status === 'PUBLISHED') return err(409, 'CONFLICT', 'Plano já publicado');
    const at = body.publishAt ? new Date(body.publishAt) : null;
    const deferred = Boolean(at && at > new Date());
    Object.assign(plan, {
      status: deferred ? 'SCHEDULED' : 'PUBLISHED',
      publishAt: deferred ? at.toISOString() : null,
      publishedAt: deferred ? null : new Date().toISOString(),
      sendWhatsapp: body.sendWhatsapp ?? true,
      autoSchedule: body.autoSchedule ?? true,
    });
    return { body: { plan: planDto(db, plan), deferred } };
  }
  if (method === 'POST' && action === 'auto-schedule') {
    await db.helpers.sleep(600);
    const force = url.searchParams.get('force') === 'true';
    const items = plan.items.filter((i) => i.outcome !== 'SKIPPED').map((i) => asSchedItem(db, i));
    const r = place(db, plan.weekStart, items, { force });
    if (r.overflow.length > 0 && !force) return overflowErr(r.overflow);
    apply(plan, r);
    return { body: { sessionsCreated: r.placements.length, sessionsFailed: 0, ...r } };
  }
  if (method === 'POST' && action === 'reschedule-pending') {
    const todo = pending();
    const ids = new Set(todo.map((i) => i.id));
    const r = place(db, plan.weekStart, todo.map((i) => asSchedItem(db, i)), {
      relax: url.searchParams.get('relax') === 'true',
      force: url.searchParams.get('force') === 'true',
      taken: bookedByDay(db, plan, ids),
    });
    if (r.overflow.length > 0) return overflowErr(r.overflow);
    apply(plan, r);
    return { status: 204, body: undefined };
  }
  if (method === 'POST' && action === 'edit') {
    if (plan.status !== 'PUBLISHED') return err(409, 'CONFLICT', 'Só planos publicados passam por esta edição');
    const incoming = (body.items ?? []).filter((x) => db.libById.has(x.libraryItemId));
    const wanted = new Set(incoming.map((x) => x.libraryItemId));
    const removed = plan.items.filter((i) => !wanted.has(i.libId));
    if (removed.some((i) => i.outcome !== 'PENDING')) {
      return err(409, 'CANT_REMOVE_COMPLETED_ITEM', 'Itens com progresso não podem ser removidos');
    }
    const byLib = new Map(plan.items.map((i) => [i.libId, i]));
    const next = incoming.map((x) => byLib.get(x.libraryItemId) ?? { ...db.planItem(plan.id, x.libraryItemId, x.order, null, 0), fresh: true });
    const added = next.filter((i) => i.fresh);
    const r = place(db, plan.weekStart, added.map((i, k) => ({ ...asSchedItem(db, i), order: k })), {
      force: body.force === true,
      taken: bookedByDay(db, { ...plan, items: next }, new Set()),
    });
    if (r.overflow.length > 0 && body.force !== true) return overflowErr(r.overflow);
    for (const [k, x] of incoming.entries()) next[k].order = x.order;
    for (const i of added) delete i.fresh;
    plan.items = next;
    if (body.adminNotes !== undefined) plan.adminNotes = body.adminNotes;
    apply(plan, r);
    return {
      body: {
        plan: planDto(db, plan),
        scheduling: { sessionsCreated: r.placements.length, sessionsFailed: 0, overflow: r.overflow, placements: r.placements, removedCount: removed.length, addedCount: added.length },
      },
    };
  }
  return undefined;
}
