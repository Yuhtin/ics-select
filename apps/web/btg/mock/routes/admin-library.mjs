// Mock routes for the admin acervo, AI usage, waitlist and WhatsApp config screens.
// Library items live in db.LIB / db.libById (shared with the plan editor search);
// the topic M2M rows (primary + covers + per-topic order) live here, keyed by item id.

const forbidden = { status: 403, body: { error: { code: 'FORBIDDEN', message: 'Somente admin' } } };
const bad = (message) => ({ status: 400, body: { error: { code: 'VALIDATION', message } } });

let booted = false;
const links = new Map(); // itemId -> [{ topicId, isPrimary, order }]
const topicList = (db) => Object.values(db.TOPICS).sort((a, b) => a.order - b.order);
const topicById = (db, id) => topicList(db).find((t) => t.id === id);
const topicBySlug = (db, slug) => topicList(db).find((t) => t.slug === slug);

// ---------- seed (runs once, on the first request, so db is fully built) ----------
const EXTRA_TOPICS = [
  ['lb', { id: 't-lb', slug: 'load-balancing', label: 'Load Balancing', order: 30 }],
  ['cache', { id: 't-cache', slug: 'caching', label: 'Caching', order: 31 }],
  ['consistency', { id: 't-cons', slug: 'consistency', label: 'Consistência e CAP', order: 40 }],
  ['cases', { id: 't-cases', slug: 'url-shortener', label: 'Case: URL Shortener', order: 50 }],
];
const EXTRA_ITEMS = [
  ['lib-lb', 'Load balancers em 7 minutos', 'https://www.youtube.com/watch?v=sCR3SAVdyCc', 'VIDEO', 'EASY', 8, 'lb', 'L4 x L7, round robin, least connections e health checks.', 'YouTube — ByteByteGo', ['concept']],
  ['lib-cache', 'Estratégias de cache: aside, through e back', 'https://blog.bytebytego.com/p/a-crash-course-in-caching-part-1', 'ARTICLE', 'MEDIUM', 20, 'cache', 'Quando cada padrão de cache compensa e o que dá errado na invalidação.', 'Article — ByteByteGo', ['tradeoffs', 'cache-aside']],
  ['lib-cap', 'CAP e PACELC sem mito', 'https://www.youtube.com/watch?v=BHqjEjzAicA', 'VIDEO', 'MEDIUM', 16, 'consistency', 'O que CAP realmente diz e por que PACELC descreve melhor sistemas reais.', 'YouTube — Hussein Nasser', ['concept', 'tradeoffs']],
  ['lib-short', 'Design de um encurtador de URL', 'https://github.com/donnemartin/system-design-primer', 'ARTICLE', 'HARD', 45, 'cases', 'Caso completo: estimativas, geração de chave, cache e sharding.', 'GitHub — system-design-primer', ['case-study']],
];
const SOURCES = { VIDEO: 'YouTube', PROBLEM: 'LeetCode', ARTICLE: 'Medium', BOOK: 'Book — Grokking Algorithms' };
const TAGS = { VIDEO: ['concept'], PROBLEM: ['practice'], ARTICLE: ['concept'], BOOK: ['concept'] };
// Per-topic pedagogical order (LibraryItemTopic.order). Missing = NULL.
const ORDERS = {
  'lib-tp': { 't-arrays': 1 }, 'lib-sw': { 't-arrays': 2 }, 'lib-lc3': { 't-arrays': 3, 't-hash': 3 }, 'lib-lc42': { 't-arrays': 4 },
  'lib-stack': { 't-stack': 1 }, 'lib-lc20': { 't-stack': 2 }, 'lib-mono': { 't-stack': 3 }, 'lib-lc739': { 't-stack': 4 },
  'lib-hash': { 't-hash': 1 }, 'lib-lc1': { 't-hash': 2 },
};
const COVERS = { 'lib-lc3': ['t-hash'], 'lib-grok': ['t-arrays'], 'lib-cache': ['t-cons'], 'lib-short': ['t-cache', 't-lb'] };

function boot(db) {
  if (booted) return;
  booted = true;
  for (const [key, t] of EXTRA_TOPICS) db.TOPICS[key] ??= t;
  for (const [id, title, url, format, difficulty, estimatedMinutes, topic, description, source, tags] of EXTRA_ITEMS) {
    if (db.libById.has(id)) continue;
    const l = { id, title, url, format, difficulty, estimatedMinutes, description, topic: db.TOPICS[topic], source, tags };
    db.LIB.push(l);
    db.libById.set(id, l);
  }
  db.LIB.forEach((l, i) => {
    l.source ??= SOURCES[l.format] ?? null;
    l.tags ??= TAGS[l.format] ?? [];
    l.tracks ??= l.id === 'lib-lc42' ? ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'] : l.format === 'PROBLEM' ? ['BIG_TECH'] : [];
    l.createdAt ??= new Date(Date.now() - (db.LIB.length - i) * db.helpers.DAY).toISOString();
    const order = ORDERS[l.id] ?? {};
    links.set(l.id, [
      { topicId: l.topic.id, isPrimary: true, order: order[l.topic.id] ?? null },
      ...(COVERS[l.id] ?? []).map((topicId) => ({ topicId, isPrimary: false, order: order[topicId] ?? null })),
    ]);
  });
}

function itemDto(db, l) {
  const topics = (links.get(l.id) ?? [])
    .map((r) => ({ r, t: topicById(db, r.topicId) }))
    .filter((x) => x.t)
    .map(({ r, t }) => ({ id: t.id, slug: t.slug, label: t.label, isPrimary: r.isPrimary, order: r.order }));
  return {
    id: l.id, title: l.title, url: l.url, description: l.description, format: l.format, difficulty: l.difficulty,
    estimatedMinutes: l.estimatedMinutes, source: l.source ?? null, tags: l.tags ?? [], tracks: l.tracks ?? [],
    topicId: topics.find((t) => t.isPrimary)?.id ?? null, topics, createdAt: l.createdAt,
  };
}

// Mirrors LibraryService.replaceTopics: first slug is primary, rest are covers, existing orders are kept.
function replaceTopics(db, l, slugs) {
  const prev = new Map((links.get(l.id) ?? []).map((r) => [r.topicId, r.order]));
  const ts = [...new Set(slugs)].map((s) => topicBySlug(db, s)).filter(Boolean);
  links.set(l.id, ts.map((t, i) => ({ topicId: t.id, isPrimary: i === 0, order: prev.get(t.id) ?? null })));
  // Built-in consumers (plan editor search, plan DTOs) read a single `topic`.
  if (ts[0]) l.topic = ts[0];
}

function validateItem(b, partial) {
  const has = (k) => b[k] !== undefined;
  if ((!partial || has('title')) && !(typeof b.title === 'string' && b.title.trim())) return 'Título obrigatório';
  if (has('url') && b.url !== null) {
    try { new URL(b.url); } catch { return 'URL inválida'; }
  }
  if ((!partial || has('format')) && !['VIDEO', 'ARTICLE', 'BOOK', 'PROBLEM', 'OTHER'].includes(b.format)) return 'Formato inválido';
  if ((!partial || has('difficulty')) && !['EASY', 'MEDIUM', 'HARD'].includes(b.difficulty)) return 'Dificuldade inválida';
  if ((!partial || has('estimatedMinutes')) && !(Number.isInteger(b.estimatedMinutes) && b.estimatedMinutes > 0)) return 'Minutos devem ser um inteiro positivo';
  return null;
}

function assign(l, b) {
  for (const k of ['title', 'url', 'description', 'format', 'difficulty', 'estimatedMinutes', 'source', 'tags']) {
    if (b[k] !== undefined) l[k] = b[k];
  }
}

// ---------- AI usage (deterministic, 90 days) ----------
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}
let aiRows = null;
function aiUsage(db) {
  if (aiRows) return aiRows;
  const r = rng(42);
  const PURPOSES = [['draft-plan', 3200, 900], ['brief-plan', 1400, 350], ['diagnose', 2600, 600], ['chat', 1800, 420]];
  const members = db.MEMBERS.map((m) => m.id);
  aiRows = [];
  for (let d = 0; d < 90; d++) {
    const calls = Math.floor(r() * (d < 14 ? 9 : 5));
    for (let c = 0; c < calls; c++) {
      const [purpose, p, o] = PURPOSES[Math.floor(r() * PURPOSES.length)];
      const promptTokens = Math.round(p * (0.6 + r() * 0.8));
      const responseTokens = Math.round(o * (0.6 + r() * 0.8));
      const cost = (promptTokens * 0.25 + responseTokens * 2) / 1_000_000;
      aiRows.push({
        id: `ai-${d}-${c}`,
        userId: purpose === 'chat' ? db.ADMIN.id : members[Math.floor(r() * members.length)],
        purpose, model: 'gpt-5.4-mini', promptTokens, responseTokens,
        costUsd: cost.toFixed(6), metadata: null,
        createdAt: new Date(Date.now() - d * db.helpers.DAY - Math.floor(r() * 10 * 3600_000)).toISOString(),
      });
    }
  }
  return aiRows;
}

// ---------- waitlist ----------
const COURSES = ['CIENCIA_COMPUTACAO', 'ADMINISTRACAO', 'ENGENHARIA_SOFTWARE', 'ENGENHARIA_COMPUTACAO', 'SISTEMAS_INFORMACAO'];
const FIRST = ['Rafael', 'Marina', 'Pedro', 'Luana', 'Thiago', 'Beatriz', 'Mateus', 'Sofia', 'Vinícius', 'Camila', 'Gustavo', 'Larissa', 'Enzo', 'Yasmin', 'Otávio', 'Helena', 'Caio', 'Júlia', 'Arthur', 'Manuela'];
const LAST = ['Andrade', 'Barros', 'Cardoso', 'Duarte', 'Esteves', 'Farias', 'Guimarães', 'Henriques', 'Ibrahim', 'Jardim'];
let waitlist = null;
function waitlistRows(db) {
  if (waitlist) return waitlist;
  const r = rng(7);
  waitlist = Array.from({ length: 64 }, (_, i) => {
    const name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(r() * LAST.length)]}`;
    const handle = name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '.');
    const at = new Date(Date.now() - Math.floor(r() * 40 * db.helpers.DAY)).toISOString();
    return {
      id: `wl-${i + 1}`, name, email: `${handle}${i}@sou.inteli.edu.br`,
      course: COURSES[Math.floor(r() * COURSES.length)], skillLevel: 1 + Math.floor(r() * 5), year: 1 + Math.floor(r() * 4),
      github: r() > 0.3 ? `https://github.com/${handle.replace('.', '')}` : null,
      linkedin: r() > 0.4 ? `https://www.linkedin.com/in/${handle.replace('.', '-')}` : null,
      cycleTarget: '2027.1', createdAt: at, updatedAt: at,
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return waitlist;
}
const csvEscape = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// ---------- WhatsApp templates ----------
const WA_DEFAULTS = {
  session_reminder: ['{summary} começa em {minutesAway} min. bom estudo {firstName}.', ['firstName', 'minutesAway', 'summary']],
  plan_published: ['teu plano da semana tá no ar, {firstName}. bons estudos.', ['firstName']],
  retro_reminder: ['Oi {firstName}, seu retrô da semana abriu. 3 perguntas rápidas, leva 5 min.', ['firstName']],
  stuck_alert: ['{firstName}, vi que você travou em {summary}. precisa de ajuda?', ['firstName', 'summary']],
  test: ['mensagem de teste do ICS Select.', []],
};
const waRows = new Map(); // kind -> { template, enabled, description, updatedAt, updatedBy }
const waDto = (kind) => {
  const row = waRows.get(kind);
  return {
    kind, template: row?.template ?? WA_DEFAULTS[kind][0], enabled: row?.enabled ?? true,
    description: row?.description ?? null, variables: WA_DEFAULTS[kind][1],
    updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null,
  };
};

export default async function ({ url, role, body, path, method, db, notFound }) {
  // Public, like the real API (lib/waitlist/api.ts calls it without auth).
  if (method === 'GET' && path === '/waitlist/config') {
    const startsAt = new Date(new Date(db.CYCLE.endsAt).getTime() + 7 * db.helpers.DAY);
    return { body: { cycleTarget: startsAt.getMonth() < 6 ? `${startsAt.getFullYear()}.2` : `${startsAt.getFullYear() + 1}.1`, startsAt: startsAt.toISOString() } };
  }
  const mine = /^\/(library|topics)(\/|$)/.test(path) || path === '/ai/usage' || path.startsWith('/admin/waitlist') || path.startsWith('/admin/whatsapp/templates');
  if (!mine) return undefined;
  // Leave the built-in search / by-id reads alone (the plan editor uses them); only add what's missing.
  if (method === 'POST' && path === '/library/search') return undefined;
  if (role !== 'admin') return forbidden;
  boot(db);

  // --- library ---
  if (method === 'GET' && path === '/library') {
    return { body: db.LIB.map((l) => itemDto(db, l)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  }
  if (method === 'POST' && path === '/library/import') {
    let u;
    try { u = new URL(body.url); } catch { return bad('URL inválida'); }
    await db.helpers.sleep(500);
    const host = u.hostname.replace(/^www\./, '');
    const format = /youtube\.com|youtu\.be/.test(host) ? 'VIDEO' : /leetcode\.com/.test(host) ? 'PROBLEM' : 'ARTICLE';
    const slug = u.pathname.split('/').filter(Boolean).pop() ?? host;
    const title = slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      body: {
        title: format === 'VIDEO' ? `Vídeo importado de ${host}` : title,
        description: `Metadados lidos de ${host}.`,
        source: host, format, estimatedMinutes: { VIDEO: 15, PROBLEM: 45, ARTICLE: 20 }[format], url: u.href,
      },
    };
  }
  if (method === 'POST' && path === '/library') {
    const err = validateItem(body, false);
    if (err) return bad(err);
    const slugs = body.topicSlugs?.length ? body.topicSlugs : [topicList(db)[0].slug];
    const l = { id: db.newId('lib'), tags: [], tracks: [], source: null, createdAt: new Date().toISOString(), topic: topicBySlug(db, slugs[0]) ?? topicList(db)[0] };
    assign(l, body);
    db.LIB.push(l);
    db.libById.set(l.id, l);
    replaceTopics(db, l, slugs);
    return { body: itemDto(db, l) };
  }
  const itemMatch = path.match(/^\/library\/([^/]+)$/);
  if (itemMatch && (method === 'PATCH' || method === 'DELETE')) {
    const l = db.LIB.find((x) => x.id === itemMatch[1]);
    if (!l) return notFound('Material não encontrado');
    if (method === 'DELETE') {
      // ponytail: stays in libById so plans that already reference it keep rendering.
      db.LIB.splice(db.LIB.indexOf(l), 1);
      links.delete(l.id);
      return { body: itemDto(db, l) };
    }
    const err = validateItem(body, true);
    if (err) return bad(err);
    assign(l, body);
    if (Array.isArray(body.topicSlugs) && body.topicSlugs.length > 0) replaceTopics(db, l, body.topicSlugs);
    return { body: itemDto(db, l) };
  }

  // --- topics ---
  if (method === 'GET' && path === '/topics') return { body: topicList(db) };
  const slugOk = (s) => typeof s === 'string' && /^[a-z0-9-]{1,40}$/.test(s);
  const labelOk = (s) => typeof s === 'string' && s.length >= 1 && s.length <= 60;
  if (method === 'POST' && path === '/topics') {
    if (!slugOk(body.slug) || !labelOk(body.label)) return bad('Slug (a-z, 0-9, -) e rótulo são obrigatórios');
    if (topicBySlug(db, body.slug)) return { status: 409, body: { error: { code: 'CONFLICT', message: 'Já existe um tópico com esse slug' } } };
    const order = body.order ?? Math.max(-1, ...topicList(db).map((t) => t.order)) + 1;
    const t = { id: db.newId('t'), slug: body.slug, label: body.label, order };
    db.TOPICS[t.id] = t;
    return { body: t };
  }
  const topicMatch = path.match(/^\/topics\/([^/]+)$/);
  if (topicMatch) {
    const entry = Object.entries(db.TOPICS).find(([, t]) => t.id === topicMatch[1]);
    if (!entry) return notFound('Tópico não encontrado');
    const [key, t] = entry;
    if (method === 'PATCH') {
      if ((body.slug !== undefined && !slugOk(body.slug)) || (body.label !== undefined && !labelOk(body.label))) return bad('Slug ou rótulo inválido');
      if (body.slug && body.slug !== t.slug && topicBySlug(db, body.slug)) return { status: 409, body: { error: { code: 'CONFLICT', message: 'Já existe um tópico com esse slug' } } };
      Object.assign(t, { slug: body.slug ?? t.slug, label: body.label ?? t.label, order: body.order ?? t.order });
      return { body: t };
    }
    if (method === 'DELETE') {
      delete db.TOPICS[key];
      for (const [id, rows] of links) {
        const next = rows.filter((r) => r.topicId !== t.id);
        if (next.length && !next.some((r) => r.isPrimary)) next[0].isPrimary = true;
        links.set(id, next);
        const l = db.libById.get(id);
        if (l && next[0]) l.topic = topicById(db, next.find((r) => r.isPrimary).topicId);
      }
      return { body: t };
    }
  }

  // --- AI usage ---
  if (method === 'GET' && path === '/ai/usage') {
    const days = Number(url.searchParams.get('sinceDays') ?? 7);
    const since = Date.now() - days * db.helpers.DAY;
    const rows = aiUsage(db).filter((r) => new Date(r.createdAt).getTime() >= since);
    return { body: { rows, totalCost: rows.reduce((s, r) => s + Number(r.costUsd), 0) } };
  }

  // --- waitlist ---
  if (method === 'GET' && path === '/admin/waitlist/stats') {
    const rows = waitlistRows(db);
    const weekAgo = Date.now() - 7 * db.helpers.DAY;
    return {
      body: {
        total: rows.length,
        last7d: rows.filter((r) => new Date(r.createdAt).getTime() >= weekAgo).length,
        byCourse: COURSES.map((course) => ({ course, count: rows.filter((r) => r.course === course).length })),
        bySkill: [1, 2, 3, 4, 5].map((skillLevel) => ({ skillLevel, count: rows.filter((r) => r.skillLevel === skillLevel).length })),
      },
    };
  }
  if (method === 'GET' && path === '/admin/waitlist/export') {
    const lines = waitlistRows(db).map((r) =>
      [r.createdAt, csvEscape(r.name), r.email, r.course, r.year, r.skillLevel, csvEscape(r.github ?? ''), csvEscape(r.linkedin ?? ''), r.cycleTarget].join(','),
    );
    return { raw: ['createdAt,name,email,course,year,skillLevel,github,linkedin,cycleTarget', ...lines].join('\n') + '\n', contentType: 'text/csv; charset=utf-8' };
  }
  if (method === 'GET' && path === '/admin/waitlist') {
    const q = url.searchParams;
    const page = Math.max(1, Number(q.get('page') ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(q.get('pageSize') ?? 50)));
    const course = q.get('course');
    const min = q.get('skillMin') ? Number(q.get('skillMin')) : null;
    const max = q.get('skillMax') ? Number(q.get('skillMax')) : null;
    const term = (q.get('q') ?? '').toLowerCase();
    const rows = waitlistRows(db).filter(
      (r) =>
        (!course || r.course === course) &&
        (min === null || r.skillLevel >= min) &&
        (max === null || r.skillLevel <= max) &&
        (!term || r.name.toLowerCase().includes(term) || r.email.toLowerCase().includes(term)),
    );
    return { body: { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize } };
  }

  // --- WhatsApp templates ---
  if (method === 'GET' && path === '/admin/whatsapp/templates') return { body: Object.keys(WA_DEFAULTS).map(waDto) };
  const waMatch = path.match(/^\/admin\/whatsapp\/templates\/([^/]+)$/);
  if (method === 'PATCH' && waMatch) {
    const kind = waMatch[1];
    if (!WA_DEFAULTS[kind]) return bad('Tipo de mensagem desconhecido');
    if (body.template !== undefined && (typeof body.template !== 'string' || body.template.length < 1 || body.template.length > 2000)) {
      return bad('A mensagem precisa ter entre 1 e 2000 caracteres');
    }
    const cur = waDto(kind);
    waRows.set(kind, {
      template: body.template ?? cur.template,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : cur.enabled,
      description: body.description !== undefined ? body.description : cur.description,
      updatedAt: new Date().toISOString(),
      updatedBy: db.ADMIN.id,
    });
    return { body: waDto(kind) };
  }

  return undefined;
}
