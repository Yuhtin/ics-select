// Stateful mock of the ICS API for the BTG POC. Covers only the endpoints the
// /btg-poc and /btgadmin-poc screens use. State lives in memory and resets on restart.
// ponytail: single in-memory cohort with one editable member (Ana). Swap for the
// real API (NEXT_PUBLIC_API_URL) once the POC is approved.
import http from 'node:http';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WEB_ORIGIN = process.env.MOCK_WEB_ORIGIN ?? 'http://localhost:3000';
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

// ---------- clock helpers ----------
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const mondayOf = (d) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const atDay = (base, dayOffset, h, m = 0) => {
  const x = new Date(base);
  x.setDate(x.getDate() + dayOffset);
  x.setHours(h, m, 0, 0);
  return x;
};
const WEEKDAY = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// ---------- library ----------
const TOPICS = {
  bigo: { id: 't-bigo', slug: 'big-o', label: 'Big-O', order: 0 },
  arrays: { id: 't-arrays', slug: 'array', label: 'Arrays e Two Pointers', order: 1 },
  hashing: { id: 't-hash', slug: 'hashing', label: 'Hashing', order: 2 },
  stacks: { id: 't-stack', slug: 'stack', label: 'Stacks e Queues', order: 3 },
  trees: { id: 't-tree', slug: 'tree', label: 'Trees', order: 4 },
  graphs: { id: 't-graph', slug: 'graph', label: 'Graphs', order: 5 },
};

const LIB = [
  ['lib-bigo', 'Big-O em 10 minutos', 'https://www.youtube.com/watch?v=__vX2sjlpXU', 'VIDEO', 'EASY', 12, 'bigo', 'Notação assintótica sem matemática pesada: O(1), O(n), O(log n) e como estimar complexidade lendo código.'],
  ['lib-tp', 'Two Pointers: visão geral', 'https://www.youtube.com/watch?v=-gjxg6Pln50', 'VIDEO', 'EASY', 20, 'arrays', 'Quando dois índices andando pelo array substituem um loop aninhado.'],
  ['lib-sw', 'Sliding Window: padrões e armadilhas', 'https://www.youtube.com/watch?v=MK-NZ4hN7rs', 'VIDEO', 'MEDIUM', 25, 'arrays', 'Fecha a ponte entre Two Pointers e Sliding Window, com janela fixa e variável.'],
  ['lib-lc3', 'LeetCode 3 · Longest Substring Without Repeating Characters', 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', 'PROBLEM', 'MEDIUM', 40, 'arrays', 'Sliding window com hash set. Clássico de entrevista.'],
  ['lib-lc42', 'LeetCode 42 · Trapping Rain Water', 'https://leetcode.com/problems/trapping-rain-water/', 'PROBLEM', 'HARD', 60, 'arrays', 'Two pointers com máximos à esquerda e à direita.'],
  ['lib-lc1', 'LeetCode 1 · Two Sum', 'https://leetcode.com/problems/two-sum/', 'PROBLEM', 'EASY', 20, 'hashing', 'O primeiro hash map de todo mundo.'],
  ['lib-hash', 'Hash maps por dentro', 'https://medium.com/@example/hash-maps-por-dentro', 'ARTICLE', 'MEDIUM', 25, 'hashing', 'Buckets, colisões e por que o lookup é O(1) na média.'],
  ['lib-lc49', 'LeetCode 49 · Group Anagrams', 'https://leetcode.com/problems/group-anagrams/', 'PROBLEM', 'MEDIUM', 35, 'hashing', 'Chave canônica em hash map.'],
  ['lib-stack', 'Stacks: a estrutura que vive no seu editor', 'https://www.youtube.com/watch?v=I5lq6sCuABE', 'VIDEO', 'EASY', 15, 'stacks', 'Undo, parênteses e a pilha de chamadas.'],
  ['lib-lc20', 'LeetCode 20 · Valid Parentheses', 'https://leetcode.com/problems/valid-parentheses/', 'PROBLEM', 'EASY', 30, 'stacks', 'Pilha para casar abre e fecha.'],
  ['lib-mono', 'Monotonic Stack explicado', 'https://www.youtube.com/watch?v=Dq_ObZwTY_Q', 'VIDEO', 'MEDIUM', 20, 'stacks', 'Próximo maior elemento em O(n).'],
  ['lib-lc739', 'LeetCode 739 · Daily Temperatures', 'https://leetcode.com/problems/daily-temperatures/', 'PROBLEM', 'MEDIUM', 35, 'stacks', 'Aplicação direta de monotonic stack.'],
  ['lib-trees', 'Árvores binárias do zero', 'https://www.youtube.com/watch?v=fAAZixBzIAI', 'VIDEO', 'EASY', 20, 'trees', 'Travessias pre, in e pós-ordem.'],
  ['lib-lc104', 'LeetCode 104 · Maximum Depth of Binary Tree', 'https://leetcode.com/problems/maximum-depth-of-binary-tree/', 'PROBLEM', 'EASY', 20, 'trees', 'Recursão em árvore.'],
  ['lib-grok', 'Grokking Algorithms · cap. 4 (Quicksort)', null, 'BOOK', 'MEDIUM', 40, 'bigo', 'Dividir para conquistar com exemplos visuais.'],
  ['lib-dijkstra', 'Dijkstra passo a passo', 'https://www.youtube.com/watch?v=pVfj6mxhdMw', 'VIDEO', 'HARD', 30, 'graphs', 'Menor caminho com fila de prioridade.'],
].map(([id, title, url, format, difficulty, estimatedMinutes, topic, description]) => ({
  id, title, url, format, difficulty, estimatedMinutes, description, topic: TOPICS[topic],
}));
const libById = new Map(LIB.map((l) => [l.id, l]));

const libraryDto = (l) => ({
  id: l.id,
  title: l.title,
  url: l.url,
  format: l.format,
  difficulty: l.difficulty,
  estimatedMinutes: l.estimatedMinutes,
  description: l.description,
  tags: [],
  tracks: ['BIG_TECH'],
  topicId: l.topic.id,
  topics: [{ id: l.topic.id, slug: l.topic.slug, label: l.topic.label, isPrimary: true }],
});

// ---------- people ----------
const ME = 'u-ana';
const ADMIN = { id: 'u-admin', email: 'diretor@inteli.edu.br', name: 'Diretor Educacional' };
const MEMBERS = [
  ['u-bruno', 'Bruno Martins', 86],
  ['u-carla', 'Carla Souza', 81],
  [ME, 'Ana Lima', 0],
  ['u-diego', 'Diego Rocha', 74],
  ['u-elisa', 'Elisa Torres', 70],
  ['u-felipe', 'Felipe Alves', 66],
  ['u-gabi', 'Gabriela Nunes', 61],
  ['u-heitor', 'Heitor Pires', 55],
  ['u-isa', 'Isabela Costa', 49],
  ['u-joao', 'João Vieira', 42],
  ['u-karina', 'Karina Lopes', 37],
  ['u-lucas', 'Lucas Freitas', 30],
].map(([id, name, score]) => ({ id, name, score, email: `${id.slice(2)}@inteli.edu.br` }));
const memberById = new Map(MEMBERS.map((m) => [m.id, m]));

// ---------- cycle ----------
const now0 = new Date();
const thisMonday = mondayOf(now0);
const CYCLE = {
  id: 'c-2026-2',
  name: 'Ciclo 2026.2',
  startsAt: new Date(thisMonday.getTime() - 2 * 7 * DAY).toISOString(),
  endsAt: new Date(thisMonday.getTime() + 6 * 7 * DAY - MIN).toISOString(),
  status: 'ACTIVE',
  rankingVisibleToMembers: true,
  weeksTotal: 8,
};
const weekNumber = () => Math.floor((mondayOf(new Date()) - new Date(CYCLE.startsAt)) / (7 * DAY)) + 1;

// ---------- Ana's published plan for this week ----------
let seq = 0;
const newId = (p) => `${p}-${++seq}`;

function planItem(planId, libId, order, dayOffset, h, m, outcome = 'PENDING') {
  const lib = libById.get(libId);
  const scheduledAt = dayOffset === null ? null : atDay(thisMonday, dayOffset, h, m).toISOString();
  return {
    id: newId('wpi'),
    planId,
    libId,
    order,
    outcome,
    reflection: null,
    actualMinutes: null,
    completedAt: outcome === 'PENDING' ? null : scheduledAt,
    scheduledAt,
    scheduledMinutes: scheduledAt ? lib.estimatedMinutes : null,
    skippable: lib.topic.slug === 'big-o',
  };
}

const todayOffset = Math.round((startOfDay(now0) - thisMonday) / DAY);
const hourNow = now0.getHours();
const minNow = now0.getMinutes();

const anaPlan = { id: 'plan-ana-w3', userId: ME, weekStart: ymd(thisMonday), status: 'PUBLISHED', adminNotes: null };
anaPlan.items = [
  // Earlier this week: some done, one stuck (shows up as "pendente").
  ...(todayOffset > 0
    ? [
        planItem(anaPlan.id, 'lib-bigo', 0, 0, 19, 0, 'DONE_EASY'),
        planItem(anaPlan.id, 'lib-lc42', 1, 0, 19, 30, 'STUCK'),
      ]
    : [planItem(anaPlan.id, 'lib-bigo', 0, 0, 8, 0, 'DONE_EASY')]),
  // Today: one done this morning, one happening now, two later.
  planItem(anaPlan.id, 'lib-tp', 2, todayOffset, Math.max(0, hourNow - 3), 0, 'DONE_EASY'),
  planItem(anaPlan.id, 'lib-sw', 3, todayOffset, hourNow, Math.max(0, minNow - 10)),
  planItem(anaPlan.id, 'lib-lc3', 4, todayOffset, Math.min(22, hourNow + 1), 30),
  planItem(anaPlan.id, 'lib-hash', 5, todayOffset, Math.min(23, hourNow + 2), 20),
  // Rest of the week.
  ...(todayOffset < 6
    ? [
        planItem(anaPlan.id, 'lib-lc1', 6, todayOffset + 1, 19, 0),
        planItem(anaPlan.id, 'lib-lc49', 7, Math.min(6, todayOffset + 2), 19, 0),
      ]
    : []),
];

// ---------- activity feed, alerts ----------
const ago = (min) => new Date(Date.now() - min * MIN).toISOString();
const feed = [
  { id: newId('ev'), kind: 'finished', at: ago(12), member: 'u-bruno', itemTitle: 'LeetCode 76 · Minimum Window Substring' },
  { id: newId('ev'), kind: 'posted_retro', at: ago(70), member: 'u-carla', itemTitle: null },
  { id: newId('ev'), kind: 'had_doubts', at: ago(190), member: 'u-diego', itemTitle: 'Hash maps por dentro' },
  { id: newId('ev'), kind: 'got_stuck', at: ago(18 * 60), member: 'u-lucas', itemTitle: 'Dijkstra passo a passo' },
  { id: newId('ev'), kind: 'finished', at: ago(26 * 60), member: 'u-elisa', itemTitle: 'LeetCode 20 · Valid Parentheses' },
];
let alerts = [
  { id: 'al-1', type: 'STUCK_RECENT', severity: 'urgent', member: 'u-lucas', targetId: 'wpi-lucas', summary: 'Travou em Dijkstra passo a passo', occurredAt: ago(18 * 60) },
  { id: 'al-2', type: 'DISAPPEARED', severity: 'attention', member: 'u-karina', targetId: null, summary: 'Sem sessão há 9 dias', occurredAt: ago(9 * 24 * 60) },
  { id: 'al-3', type: 'PLAN_PENDING', severity: 'attention', member: 'u-diego', targetId: null, summary: 'Sem plano para a próxima semana', occurredAt: ago(5 * 60) },
];

// ---------- drafts built in the admin plan editor ----------
const plans = new Map([[anaPlan.id, anaPlan]]);
const draftByMember = new Map();

// ---------- derived views ----------
const isPositive = (o) => ['DONE_EASY', 'DONE_HARD', 'DOUBTS', 'SKIPPED'].includes(o);
const personDto = (id) => {
  const m = memberById.get(id);
  return { id, name: m.name, pictureUrl: null };
};

function anaScore() {
  const done = anaPlan.items.filter((i) => isPositive(i.outcome)).length;
  return Math.min(95, 64 + done * 4);
}
const scoreOf = (m) => (m.id === ME ? anaScore() : m.score);
const rankedMembers = () => [...MEMBERS].sort((a, b) => scoreOf(b) - scoreOf(a) || a.name.localeCompare(b.name));

function homeItemDto(i) {
  const lib = libById.get(i.libId);
  return {
    id: i.id,
    planId: i.planId,
    order: i.order,
    title: lib.title,
    format: lib.format,
    estimatedMinutes: lib.estimatedMinutes,
    url: lib.url,
    topic: { slug: lib.topic.slug, label: lib.topic.label },
    outcome: i.outcome,
    skippable: i.skippable,
    scheduledAt: i.scheduledAt,
    scheduledMinutes: i.scheduledMinutes,
    carriedFromItemId: null,
  };
}

function home() {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY);
  const byTime = [...anaPlan.items].sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
  const todays = byTime.filter((i) => i.scheduledAt && new Date(i.scheduledAt) >= today && new Date(i.scheduledAt) < tomorrow);
  const late = byTime.filter(
    (i) => i.scheduledAt && new Date(i.scheduledAt) < today && (i.outcome === 'PENDING' || i.outcome === 'STUCK'),
  );
  const future = byTime.filter((i) => i.scheduledAt && new Date(i.scheduledAt) >= tomorrow);
  const days = [];
  for (const i of future) {
    const d = new Date(i.scheduledAt);
    const label = startOfDay(d).getTime() === tomorrow.getTime() ? 'Amanhã' : WEEKDAY[d.getDay()];
    const date = ymd(d);
    let bucket = days.find((b) => b.date === date);
    if (!bucket) days.push((bucket = { label, date, items: [] }));
    bucket.items.push(homeItemDto(i));
  }

  let hero = null;
  const pending = todays.filter((i) => i.outcome === 'PENDING');
  const current = pending.find((i) => {
    const s = new Date(i.scheduledAt).getTime();
    return s <= now.getTime() && now.getTime() < s + i.scheduledMinutes * MIN;
  });
  const lateOne = pending.find((i) => new Date(i.scheduledAt).getTime() + i.scheduledMinutes * MIN <= now.getTime());
  const next = pending.find((i) => new Date(i.scheduledAt) > now);
  if (current) hero = { state: 'now', item: homeItemDto(current) };
  else if (lateOne) hero = { state: 'running_late', item: homeItemDto(lateOne), minutesLate: Math.round((now - new Date(lateOne.scheduledAt)) / MIN - lateOne.scheduledMinutes) };
  else if (next) hero = { state: 'up_next', item: homeItemDto(next), minutesUntil: Math.round((new Date(next.scheduledAt) - now) / MIN) };
  else if (todays.length > 0) hero = { state: 'all_done', nextAt: future[0]?.scheduledAt ?? null };
  else hero = { state: 'free_day', nextAt: future[0]?.scheduledAt ?? null };

  const coverage = new Map();
  for (const i of anaPlan.items) {
    const t = libById.get(i.libId).topic;
    const c = coverage.get(t.id) ?? { topicId: t.id, slug: t.slug, label: t.label, order: t.order, itemsPlanned: 0, itemsDone: 0 };
    c.itemsPlanned += 1;
    if (isPositive(i.outcome)) c.itemsDone += 1;
    coverage.set(t.id, c);
  }

  const activeToday = anaPlan.items.some((i) => i.completedAt && new Date(i.completedAt) >= today);
  return {
    hero,
    today: todays.map(homeItemDto),
    late: late.map(homeItemDto),
    days,
    unscheduled: [],
    streak: { current: activeToday ? 6 : 5, last7: [true, true, false, true, true, true, activeToday] },
    carryOverReflection: null,
    topicCoverage: [...coverage.values()].sort((a, b) => a.order - b.order),
    studyTime: null,
  };
}

function itemDto(i) {
  const lib = libById.get(i.libId);
  return {
    id: i.id,
    planId: i.planId,
    order: i.order,
    outcome: i.outcome,
    skippable: i.skippable,
    reflection: i.reflection,
    completedAt: i.completedAt,
    scheduledAt: i.scheduledAt,
    scheduledMinutes: i.scheduledMinutes,
    libraryItem: {
      id: lib.id,
      title: lib.title,
      description: lib.description,
      url: lib.url,
      format: lib.format,
      estimatedMinutes: lib.estimatedMinutes,
      topic: { slug: lib.topic.slug, label: lib.topic.label },
    },
    carriedFrom: null,
  };
}

const feedDto = (e) => ({ id: e.id, kind: e.kind, at: e.at, member: personDto(e.member), itemTitle: e.itemTitle, itemId: null });

function cohort(meId) {
  return {
    cycleName: CYCLE.name,
    memberCount: MEMBERS.length,
    weekEndsAt: new Date(thisMonday.getTime() + 7 * DAY - MIN).toISOString(),
    members: MEMBERS.map((m) => ({ userId: m.id, name: m.name, email: m.email, pictureUrl: null, isMe: m.id === meId })),
    feed: [...feed].sort((a, b) => b.at.localeCompare(a.at)).map(feedDto),
    ranking: CYCLE.rankingVisibleToMembers
      ? rankedMembers().map((m) => ({ userId: m.id, name: m.name, pictureUrl: null, score: scoreOf(m), isMe: m.id === meId }))
      : undefined,
  };
}

const WEIGHTS = [
  ['Cohort rank', 20],
  ['Days active', 15],
  ['Plan completion', 27],
  ['Retros submitted', 21],
  ['Class attendance', 5],
  ['Recency', 12],
];

function cycleOverview() {
  const wn = weekNumber();
  const ranked = rankedMembers();
  const alertIds = new Set(alerts.filter((a) => a.severity !== 'scheduled').map((a) => a.member));
  const pct = (m) => Math.max(0, Math.min(100, Math.round(scoreOf(m) * 1.1 - 10)));
  return {
    cycle: { ...CYCLE, weekNumber: wn },
    members: MEMBERS.map((m) => ({
      userId: m.id,
      name: m.name,
      pictureUrl: null,
      track: 'BIG_TECH',
      percentThisWeek: pct(m),
      done: Math.round(pct(m) / 20),
      total: 5,
      hasAlert: alertIds.has(m.id),
      availability: { itemsCount: 5, plannedMinutes: 240, budgetMinutes: 300 },
    })),
    heatmap: {
      weeks: Array.from({ length: wn }, (_, k) => ({
        index: k + 1,
        label: `S${k + 1}`,
        startsAt: new Date(new Date(CYCLE.startsAt).getTime() + k * 7 * DAY).toISOString(),
      })),
      rows: ranked.map((m) => ({
        userId: m.id,
        name: m.name,
        cells: Array.from({ length: wn }, (_, k) => Math.max(0, Math.min(100, pct(m) + (k - 1) * 8 - (k === wn - 1 ? 20 : 0)))),
      })),
    },
    feed: [...feed].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20).map(feedDto),
    ranking: ranked.map((m) => ({
      userId: m.id,
      name: m.name,
      pictureUrl: null,
      score: scoreOf(m),
      hasAlert: alertIds.has(m.id),
      breakdown: WEIGHTS.map(([label, weight]) => ({
        label,
        weight,
        value: Math.round(((weight * scoreOf(m)) / 100) * 10) / 10,
        status: scoreOf(m) >= 66 ? 'ok' : scoreOf(m) >= 33 ? 'warn' : 'bad',
      })),
    })),
  };
}

function triage() {
  return {
    alerts: alerts.map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      member: { ...personDto(a.member), whatsappPhone: null },
      targetId: a.targetId,
      summary: a.summary,
      occurredAt: a.occurredAt,
      dismissKey: a.id,
    })),
    cohortStrip: [],
    cycleInfo: {
      cycleId: CYCLE.id,
      cycleName: CYCLE.name,
      weekNumber: weekNumber(),
      weeksTotal: CYCLE.weeksTotal,
      daysUntilWeekEnds: 7 - todayOffset,
      hasStarted: true,
      daysUntilStart: 0,
    },
  };
}

// ---------- plans (admin editor) ----------
function weeklyPlanDto(p) {
  const weekStart = new Date(`${p.weekStart}T00:00:00`);
  return {
    id: p.id,
    userId: p.userId,
    cycleId: CYCLE.id,
    weekStart: p.weekStart,
    weekEnd: ymd(new Date(weekStart.getTime() + 6 * DAY)),
    status: p.status,
    adminNotes: p.adminNotes,
    publishAt: null,
    sendWhatsapp: true,
    autoSchedule: true,
    items: [...p.items]
      .sort((a, b) => a.order - b.order)
      .map((i) => {
        const lib = libById.get(i.libId);
        return {
          id: i.id,
          libraryItemId: lib.id,
          order: i.order,
          outcome: i.outcome,
          skippable: i.skippable,
          scheduledAt: i.scheduledAt,
          scheduledMinutes: i.scheduledMinutes,
          libraryItem: {
            id: lib.id,
            title: lib.title,
            estimatedMinutes: lib.estimatedMinutes,
            format: lib.format,
            url: lib.url,
            topicId: lib.topic.id,
            tags: [],
            tracks: ['BIG_TECH'],
          },
        };
      }),
  };
}

function getOrCreateDraft(memberId) {
  if (draftByMember.has(memberId)) return draftByMember.get(memberId);
  const nextMonday = new Date(thisMonday.getTime() + 7 * DAY);
  const draft = { id: `plan-${memberId.slice(2)}-next`, userId: memberId, weekStart: ymd(nextMonday), status: 'DRAFT', adminNotes: null, items: [] };
  plans.set(draft.id, draft);
  draftByMember.set(memberId, draft);
  return draft;
}

function carryOverFor(memberId) {
  if (memberId === ME) {
    const today = startOfDay(new Date());
    return anaPlan.items
      .filter((i) => i.outcome === 'STUCK' || (i.outcome === 'PENDING' && i.scheduledAt && new Date(i.scheduledAt) < today))
      .map((i) => {
        const lib = libById.get(i.libId);
        return {
          id: i.id,
          libraryItemId: lib.id,
          title: lib.title,
          outcome: i.outcome,
          reflection: i.reflection,
          topicId: lib.topic.id,
          topicLabel: lib.topic.label,
          estimatedMinutes: lib.estimatedMinutes,
        };
      });
  }
  const lib = libById.get(memberId === 'u-lucas' ? 'lib-dijkstra' : 'lib-lc42');
  return [{ id: `wpi-${memberId}`, libraryItemId: lib.id, title: lib.title, outcome: 'STUCK', reflection: null, topicId: lib.topic.id, topicLabel: lib.topic.label, estimatedMinutes: lib.estimatedMinutes }];
}

const AVAILABILITY = { perDay: [90, 90, 90, 90, 60, 0, 0], startHour: 19 };

function planContext(memberId) {
  const m = memberById.get(memberId);
  const [mon, tue, wed, thu, fri, sat, sun] = AVAILABILITY.perDay;
  return {
    member: { id: memberId, name: m?.name ?? 'Membro', pictureUrl: null, track: 'BIG_TECH' },
    cycle: { id: CYCLE.id, name: CYCLE.name, weekNumber: weekNumber(), weeksTotal: CYCLE.weeksTotal },
    lastWeek: { weekStart: ymd(thisMonday), outcomes: { done_easy: 3, done_hard: 1, doubts: 1, stuck: 1, skipped: 0, pending: 2 }, items: [] },
    carryOverCandidates: carryOverFor(memberId),
    retro: null,
    topicCoverage: [],
    availability: {
      mondayMinutes: mon, tuesdayMinutes: tue, wednesdayMinutes: wed, thursdayMinutes: thu,
      fridayMinutes: fri, saturdayMinutes: sat, sundayMinutes: sun,
      preferredSessionMinutes: 45,
      weeklyBudgetMinutes: AVAILABILITY.perDay.reduce((s, x) => s + x, 0),
      timezone: 'America/Sao_Paulo',
      remainingCapacityMinutes: null,
      daysRemaining: 5,
      slots: [],
      busyBlocks: [],
    },
    memberHistory: [],
  };
}

// Greedy placement in plan order, never moving backwards (same contract as the real scheduler).
function schedule(weekStartYmd, items) {
  const weekStart = new Date(`${weekStartYmd}T00:00:00`);
  const placements = [];
  const overflow = [];
  let day = 0;
  let used = 0;
  for (const it of [...items].sort((a, b) => a.order - b.order)) {
    const need = it.estimatedMinutes;
    while (day < 7 && used + need > AVAILABILITY.perDay[day]) {
      if (used === 0 && need > AVAILABILITY.perDay[day] && AVAILABILITY.perDay[day] > 0) break;
      day += 1;
      used = 0;
    }
    if (day >= 7 || need > AVAILABILITY.perDay[day]) {
      overflow.push({ itemId: it.libraryItemId, minutesRequired: need });
      continue;
    }
    placements.push({
      itemId: it.libraryItemId,
      scheduledAt: atDay(weekStart, day, AVAILABILITY.startHour, used).toISOString(),
      durationMinutes: need,
    });
    used += need;
  }
  return { placements, overflow };
}

const allocated = (lib) => (lib.format === 'VIDEO' ? lib.estimatedMinutes * 2 : lib.estimatedMinutes);

function aiDraft(memberId) {
  const carry = carryOverFor(memberId).map((c) => c.libraryItemId);
  const doneIds = new Set(memberId === ME ? anaPlan.items.filter((i) => isPositive(i.outcome)).map((i) => i.libId) : []);
  const fresh = LIB.filter((l) => l.topic.slug === 'stack' && !doneIds.has(l.id) && !carry.includes(l.id)).map((l) => l.id);
  const ids = [...carry, ...fresh].slice(0, 5);
  const m = memberById.get(memberId);
  return {
    draft: {
      items: ids.map((id, order) => ({
        libraryItemId: id,
        order,
        rationale: carry.includes(id) ? 'Ficou pendente na semana passada.' : 'Abre o próximo tópico da fase pela base conceitual.',
      })),
      alternates: [],
      narrative: `${m?.name.split(' ')[0] ?? 'O membro'} está com Arrays quase fechado. O plano retoma o que travou (${carry.length} ${carry.length === 1 ? 'item' : 'itens'} de carry-over) e abre Stacks e Queues pela base conceitual antes da prática no LeetCode.`,
      totalMinutes: ids.reduce((s, id) => s + libById.get(id).estimatedMinutes, 0),
    },
    usage: { model: 'mock', costUsd: 0 },
  };
}

// ---------- HTTP ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loginChooser(res) {
  const link = (token, label, sub) =>
    `<a href="${WEB_ORIGIN}/auth/callback?token=${token}"><b>${label}</b><span>${sub}</span></a>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Login mockado</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#05132A;font-family:Helvetica,Arial,sans-serif}
main{background:#fff;border-radius:8px;padding:32px;width:360px;display:flex;flex-direction:column;gap:12px}
h1{margin:0 0 4px;font-size:20px;font-weight:400;color:#001E61}p{margin:0 0 8px;color:rgba(0,0,0,.64);font-size:14px}
a{display:flex;flex-direction:column;gap:2px;padding:14px 16px;border:1px solid #DCDCDF;border-radius:4px;text-decoration:none;color:#0A0A0A}
a:hover{border-color:#195AB4;background:#EAF2FF}b{font-weight:600;color:#195AB4}span{font-size:13px;color:rgba(0,0,0,.64)}</style></head>
<body><main><h1>Login mockado</h1><p>Nenhuma conta Google é usada. Escolha o perfil:</p>
${link('mock-member', 'Entrar como membro', 'Ana Lima · /btg-poc')}
${link('mock-admin', 'Entrar como Diretor Educacional', 'Admin · /btgadmin-poc')}
</main></body></html>`);
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const notFound = (msg = 'Mock: endpoint não simulado') => ({ status: 404, body: { error: { code: 'NOT_FOUND', message: msg } } });

async function route(req, url, role) {
  const p = url.pathname;
  const m = req.method;
  const is = (method, re) => m === method && re.test(p);
  const body = m === 'GET' ? {} : await readJson(req);

  if (is('POST', /^\/auth\/refresh$/)) return { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'mock' } } };
  if (is('POST', /^\/auth\/logout$/)) return { body: { ok: true } };
  // Screen-group plugins (mock/routes/*.mjs) run first, so they can add or override
  // endpoints. They also see unauthenticated requests (role === null) for public routes.
  for (const plugin of plugins) {
    const out = await plugin({ req, url, role, body, path: p, method: m, db, notFound });
    if (out) return out;
  }
  if (!role) return { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'Faça login no mock' } } };

  // --- me ---
  if (is('GET', /^\/me$/)) {
    const u = role === 'admin' ? ADMIN : memberById.get(ME);
    return {
      body: {
        id: u.id, email: u.email, name: u.name, pictureUrl: null,
        role: role === 'admin' ? 'ADMIN' : 'MEMBER',
        privacyAcceptedAt: now0.toISOString(), whatsappPhone: '+5511999999999',
        targetTrack: 'BIG_TECH', googleConnected: true, theme: 'light',
      },
    };
  }
  if (is('PATCH', /^\/me(\/.*)?$/)) return { body: { ok: true } };
  if (is('GET', /^\/me\/home$/)) return { body: home() };
  if (is('GET', /^\/me\/cohort$/)) return { body: cohort(role === 'admin' ? null : ME) };
  if (is('GET', /^\/me\/retro\/current$/)) return { body: { open: false, retro: null } };
  if (is('GET', /^\/me\/item\/[^/]+$/)) {
    const it = anaPlan.items.find((i) => i.id === p.split('/').pop());
    return it ? { body: itemDto(it) } : notFound('Item não encontrado');
  }
  const outcomeMatch = p.match(/^\/plans\/([^/]+)\/items\/([^/]+)\/outcome$/);
  if (m === 'PATCH' && outcomeMatch) {
    const it = anaPlan.items.find((i) => i.id === outcomeMatch[2]);
    if (!it) return notFound('Item não encontrado');
    it.outcome = body.outcome;
    if (body.reflection !== undefined) it.reflection = body.reflection?.trim() ? body.reflection : null;
    it.actualMinutes = body.actualMinutes ?? null;
    it.completedAt = it.outcome === 'PENDING' ? null : new Date().toISOString();
    const kind = { DONE_EASY: 'finished', DONE_HARD: 'finished', DOUBTS: 'had_doubts', STUCK: 'got_stuck' }[it.outcome];
    if (kind) feed.push({ id: newId('ev'), kind, at: new Date().toISOString(), member: ME, itemTitle: libById.get(it.libId).title });
    if (it.outcome === 'STUCK') {
      alerts.unshift({ id: newId('al'), type: 'STUCK_RECENT', severity: 'urgent', member: ME, targetId: it.id, summary: `Travou em ${libById.get(it.libId).title}`, occurredAt: new Date().toISOString() });
    }
    return { body: itemDto(it) };
  }

  // Everything below is admin-only, like the real API.
  if (role !== 'admin') return { status: 403, body: { error: { code: 'FORBIDDEN', message: 'Somente admin' } } };

  if (is('GET', /^\/admin\/cycle\/(active|[^/]+)$/)) return { body: cycleOverview() };
  if (is('GET', /^\/admin\/triage$/)) return { body: triage() };
  if (is('POST', /^\/admin\/alerts\/dismiss$/)) {
    alerts = alerts.filter((a) => !(a.type === body.alertType && (a.targetId ?? a.member) === body.targetId));
    return { body: { ok: true } };
  }
  if (is('PATCH', /^\/cycles\/[^/]+$/)) {
    if (typeof body.rankingVisibleToMembers === 'boolean') CYCLE.rankingVisibleToMembers = body.rankingVisibleToMembers;
    return { body: { ok: true } };
  }
  const draftMatch = p.match(/^\/admin\/member\/([^/]+)\/plan-drafts$/);
  if (m === 'POST' && draftMatch) {
    if (!memberById.has(draftMatch[1])) return notFound('Membro não encontrado');
    return { body: weeklyPlanDto(getOrCreateDraft(draftMatch[1])) };
  }
  const ctxMatch = p.match(/^\/admin\/member\/([^/]+)\/plan-context$/);
  if (m === 'GET' && ctxMatch) return { body: planContext(ctxMatch[1]) };

  const planMatch = p.match(/^\/plans\/([^/]+)(\/[a-z-]+)?$/);
  if (planMatch) {
    const plan = plans.get(planMatch[1]);
    if (!plan) return notFound('Plano não encontrado');
    const action = planMatch[2] ?? '';
    if (m === 'GET' && action === '') return { body: weeklyPlanDto(plan) };
    if (m === 'PATCH' && action === '') {
      if (plan.status !== 'DRAFT') return { status: 409, body: { error: { code: 'CONFLICT', message: 'Plano já publicado' } } };
      if (Array.isArray(body.items)) {
        plan.items = body.items
          .filter((x) => libById.has(x.libraryItemId))
          .map((x) => ({ ...planItem(plan.id, x.libraryItemId, x.order, null, 0), scheduledAt: null, scheduledMinutes: null }));
      }
      if (body.adminNotes !== undefined) plan.adminNotes = body.adminNotes;
      return { body: weeklyPlanDto(plan) };
    }
    if (m === 'POST' && action === '/preview-scheduling') {
      const r = schedule(plan.weekStart, body.items ?? []);
      return { body: { ...r, busyBlocks: [], weekStart: plan.weekStart, weekEnd: plan.weekStart } };
    }
    if (m === 'POST' && action === '/publish') {
      plan.status = 'PUBLISHED';
      return { body: { plan: weeklyPlanDto(plan), deferred: false } };
    }
    if (m === 'POST' && action === '/auto-schedule') {
      await sleep(600);
      const r = schedule(
        plan.weekStart,
        plan.items.map((i) => ({ libraryItemId: i.libId, order: i.order, estimatedMinutes: allocated(libById.get(i.libId)) })),
      );
      for (const pl of r.placements) {
        const it = plan.items.find((i) => i.libId === pl.itemId);
        it.scheduledAt = pl.scheduledAt;
        it.scheduledMinutes = pl.durationMinutes;
      }
      if (r.overflow.length > 0 && !url.searchParams.get('force')) {
        return { status: 409, body: { error: { code: 'PLAN_OVERFLOW', message: 'Itens não couberam na agenda', details: { overflow: r.overflow } } } };
      }
      return { body: { sessionsCreated: r.placements.length, sessionsFailed: 0, ...r } };
    }
  }

  if (is('POST', /^\/ai\/draft-plan$/)) {
    await sleep(1200);
    return { body: aiDraft(body.memberId) };
  }
  if (is('POST', /^\/library\/search$/)) {
    const q = String(body.query ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const data = LIB.filter((l) =>
      `${l.title} ${l.topic.label}`.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(q),
    ).map(libraryDto);
    return { body: { data, total: data.length } };
  }
  if (is('GET', /^\/library\/[^/]+$/)) {
    const lib = libById.get(p.split('/').pop());
    return lib ? { body: libraryDto(lib) } : notFound('Material não encontrado');
  }

  return notFound();
}

// Shared state and helpers for route plugins. Plugins mutate these objects in place.
export const db = {
  TOPICS, LIB, libById, libraryDto,
  ME, ADMIN, MEMBERS, memberById, personDto, scoreOf, rankedMembers,
  CYCLE, weekNumber, thisMonday, todayOffset,
  anaPlan, plans, draftByMember, getOrCreateDraft, weeklyPlanDto, planItem, schedule, allocated, AVAILABILITY,
  feed, feedDto,
  get alerts() { return alerts; },
  set alerts(v) { alerts = v; },
  itemDto, homeItemDto, isPositive, newId,
  helpers: { startOfDay, mondayOf, ymd, atDay, ago, sleep, MIN, DAY, WEEKDAY },
};

// ponytail: plugins load once at startup; restart `node apps/web/btg/mock/dev.mjs` after adding one.
const routesDir = fileURLToPath(new URL('./routes/', import.meta.url));
const plugins = await Promise.all(
  readdirSync(routesDir)
    .filter((f) => f.endsWith('.mjs'))
    .sort()
    .map(async (f) => (await import(pathToFileURL(routesDir + f).href)).default),
);

export function startMockApi(port = Number(process.env.MOCK_API_PORT ?? 3999)) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', WEB_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.end();

    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === 'GET' && url.pathname === '/auth/google') return loginChooser(res);

    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const role = token === 'mock-admin' ? 'admin' : token === 'mock-member' ? 'member' : null;
    try {
      const out = await route(req, url, role);
      res.statusCode = out.status ?? 200;
      // `{ raw, contentType }` sends a non-JSON body (e.g. CSV) as-is.
      res.setHeader('Content-Type', out.raw !== undefined ? out.contentType ?? 'text/plain' : 'application/json');
      res.end(out.raw !== undefined ? out.raw : JSON.stringify(out.body));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { code: 'INTERNAL', message: String(err) } }));
    }
  });
  server.listen(port, () => console.log(`[btg-mock] API mockada em http://localhost:${port}`));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startMockApi();
