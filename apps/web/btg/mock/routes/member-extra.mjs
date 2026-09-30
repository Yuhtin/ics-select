// Mock routes for the member "extra" screens: agenda, retro, settings, onboarding.
// State lives on db.memberExtra so other plugins can read it.
const TRACKS = ['BIG_TECH', 'CONSULTING_TECH', 'COMPETITIVE_PROGRAMMING', 'STARTUP', 'OTHER'];
const PHONE = /^\+\d{8,15}$/;
const DAY_KEYS = ['mondayMinutes', 'tuesdayMinutes', 'wednesdayMinutes', 'thursdayMinutes', 'fridayMinutes', 'saturdayMinutes', 'sundayMinutes'];
const bad = (message) => ({ status: 400, body: { error: { code: 'VALIDATION', message } } });

function state(db) {
  if (db.memberExtra) return db.memberExtra;
  const perDay = db.AVAILABILITY.perDay;
  db.memberExtra = {
    // MOCK_ONBOARDING=1 starts Ana without a track, so the onboarding gate kicks in.
    profile: {
      whatsappPhone: '+5511999999999',
      targetTrack: process.env.MOCK_ONBOARDING === '1' ? null : 'BIG_TECH',
      theme: 'light',
      googleConnected: true,
    },
    availability: {
      ...Object.fromEntries(DAY_KEYS.map((k, i) => [k, perDay[i] || null])),
      preferredSessionMinutes: 45,
      timezone: 'America/Sao_Paulo',
      calendarBusy: true,
      slots: perDay.flatMap((m, d) => (m > 0 ? [{ dayOfWeek: d, startMinute: 19 * 60, endMinute: 22 * 60 }] : [])),
    },
    retro: null,
  };
  return db.memberExtra;
}

// Keep the admin plan editor's scheduler in sync with what the member declares.
function syncScheduler(db, a) {
  db.AVAILABILITY.perDay = DAY_KEYS.map((k, d) => {
    const slotMin = a.slots.filter((s) => s.dayOfWeek === d).reduce((s, x) => s + x.endMinute - x.startMinute, 0);
    return a[k] == null ? slotMin : Math.min(a[k], slotMin);
  });
}

function slotsOverlap(slots) {
  for (let d = 0; d < 7; d++) {
    const list = slots.filter((s) => s.dayOfWeek === d).sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 0; i < list.length; i++) {
      if (list[i].endMinute <= list[i].startMinute) return true;
      if (i > 0 && list[i].startMinute < list[i - 1].endMinute) return true;
    }
  }
  return false;
}

function calendarWeek(db, weekStartYmd) {
  const { atDay, DAY, MIN } = db.helpers;
  const start = new Date(`${weekStartYmd}T00:00:00`);
  const end = new Date(start.getTime() + 7 * DAY);
  const inWeek = (iso) => iso && new Date(iso) >= start && new Date(iso) < end;
  const events = [];
  for (const plan of db.plans.values()) {
    if (plan.userId !== db.ME || plan.status !== 'PUBLISHED') continue;
    for (const i of plan.items) {
      if (!inWeek(i.scheduledAt)) continue;
      const lib = db.libById.get(i.libId);
      events.push({
        id: `ics-${i.id}`,
        kind: 'ICS',
        title: lib.title,
        start: i.scheduledAt,
        end: new Date(new Date(i.scheduledAt).getTime() + (i.scheduledMinutes ?? lib.estimatedMinutes) * MIN).toISOString(),
        allDay: false,
        htmlLink: 'https://calendar.google.com/',
        ics: {
          planId: plan.id,
          itemId: i.id,
          url: lib.url,
          format: lib.format,
          topic: { slug: lib.topic.slug, label: lib.topic.label },
          outcome: i.outcome,
        },
      });
    }
  }
  // Google Calendar noise so the grid looks lived in (start is Sunday).
  const ext = (id, title, day, h, m, minutes, extra = {}) => {
    const s = atDay(start, day, h, m);
    events.push({ id: `ext-${id}-${weekStartYmd}`, kind: 'EXTERNAL', title, start: s.toISOString(), end: new Date(s.getTime() + minutes * MIN).toISOString(), allDay: false, ...extra });
  };
  for (let d = 1; d <= 5; d++) ext(`daily-${d}`, 'Daily do estágio', d, 9, 0, 15, { meetLink: 'https://meet.google.com/abc-defg-hij' });
  ext('mentor', '1:1 com mentor', 4, 17, 0, 45, { meetLink: 'https://meet.google.com/xyz-mnop-qrs' });
  ext('aula', 'Aula ICS · System Design', 3, 20, 0, 90, { location: 'Inteli, sala 4' });
  events.push({ id: `ext-provas-${weekStartYmd}`, kind: 'EXTERNAL', title: 'Semana de provas', start: atDay(start, 5, 0).toISOString(), end: atDay(start, 6, 0).toISOString(), allDay: true });
  return events.sort((a, b) => a.start.localeCompare(b.start));
}

function retroCurrent(db) {
  const s = state(db);
  const { atDay } = db.helpers;
  const items = [...db.anaPlan.items].sort((a, b) => a.order - b.order);
  const count = (o) => items.filter((i) => i.outcome === o).length;
  return {
    open: true,
    retro: s.retro,
    windowOpensAt: atDay(db.thisMonday, -3, 18).toISOString(),
    windowClosesAt: atDay(db.thisMonday, 9, 23, 59).toISOString(),
    weekRecap: {
      stats: {
        nailed: count('DONE_EASY'),
        hard: count('DONE_HARD'),
        doubts: count('DOUBTS'),
        stuck: count('STUCK'),
        skipped: count('SKIPPED'),
        minutesStudied: items.reduce((sum, i) => sum + (i.actualMinutes ?? 0), 0),
      },
      items: items.map((i) => {
        const lib = db.libById.get(i.libId);
        return { id: i.id, title: lib.title, format: lib.format, estimatedMinutes: lib.estimatedMinutes, url: lib.url, outcome: i.outcome, order: i.order };
      }),
    },
  };
}

export default async function memberExtra({ url, role, body, path, method, db }) {
  if (role !== 'member') return undefined;
  const s = state(db);

  if (method === 'GET' && path === '/me') {
    const u = db.memberById.get(db.ME);
    return {
      body: {
        id: u.id, email: u.email, name: u.name, pictureUrl: null, role: 'MEMBER',
        privacyAcceptedAt: new Date().toISOString(),
        ...s.profile,
      },
    };
  }

  if (method === 'PATCH' && path === '/me/profile') {
    if (body.whatsappPhone !== undefined && body.whatsappPhone !== null && !PHONE.test(body.whatsappPhone)) {
      return bad('Telefone inválido. Use o formato +5511999999999.');
    }
    if (body.targetTrack !== undefined && body.targetTrack !== null && !TRACKS.includes(body.targetTrack)) {
      return bad('Trilha inválida.');
    }
    if (body.whatsappPhone !== undefined) s.profile.whatsappPhone = body.whatsappPhone;
    if (body.targetTrack !== undefined) s.profile.targetTrack = body.targetTrack;
    return { body: { ok: true } };
  }

  if (method === 'PATCH' && path === '/me/theme') {
    if (!['LIGHT', 'DARK'].includes(body.themePreference)) return bad('Tema inválido.');
    s.profile.theme = body.themePreference.toLowerCase();
    return { body: { ok: true } };
  }

  if (method === 'GET' && path === '/me/availability') return { body: s.availability };
  if (method === 'PATCH' && path === '/me/availability') {
    const a = s.availability;
    if (Array.isArray(body.slots) && slotsOverlap(body.slots)) return bad('Faixas de horário se sobrepõem.');
    for (const k of [...DAY_KEYS, 'preferredSessionMinutes', 'timezone', 'calendarBusy']) {
      if (body[k] !== undefined) a[k] = body[k];
    }
    if (Array.isArray(body.slots)) {
      a.slots = body.slots.map(({ dayOfWeek, startMinute, endMinute }) => ({ dayOfWeek, startMinute, endMinute }));
    } else if (a.slots.length === 0) {
      // Same as the real API: caps without slots get default 09:00–23:00 windows.
      a.slots = DAY_KEYS.flatMap((k, d) => (a[k] > 0 ? [{ dayOfWeek: d, startMinute: 9 * 60, endMinute: 23 * 60 }] : []));
    }
    syncScheduler(db, a);
    return { body: a };
  }

  if (method === 'GET' && path === '/me/calendar') {
    const weekStart = url.searchParams.get('weekStart');
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return bad('weekStart é obrigatório (YYYY-MM-DD).');
    return {
      body: {
        weekStart,
        weekEnd: db.helpers.ymd(new Date(new Date(`${weekStart}T00:00:00`).getTime() + 6 * db.helpers.DAY)),
        timezone: s.availability.timezone,
        hasGoogleConnection: s.profile.googleConnected,
        events: calendarWeek(db, weekStart),
      },
    };
  }

  const ev = path.match(/^\/me\/calendar\/events\/([^/]+)$/);
  if (method === 'PATCH' && ev) {
    const start = new Date(body.start);
    const end = new Date(body.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return bad('start e end precisam ser datas ISO.');
    if (end <= start) return bad('O fim precisa ser depois do início.');
    const itemId = ev[1].startsWith('ics-') ? ev[1].slice(4) : null;
    const item = itemId && [...db.plans.values()].filter((p) => p.userId === db.ME).flatMap((p) => p.items).find((i) => i.id === itemId);
    if (!item) return { status: 403, body: { error: { code: 'FORBIDDEN', message: 'Só é possível remarcar blocos do ICS.' } } };
    item.scheduledAt = start.toISOString();
    item.scheduledMinutes = Math.round((end - start) / db.helpers.MIN);
    return { status: 204, body: undefined };
  }

  if (method === 'GET' && path === '/me/retro/current') return { body: retroCurrent(db) };
  if (method === 'POST' && path === '/me/retro') {
    for (const k of ['whatClicked', 'whatStuck', 'nextWeekWish']) {
      if (body[k] !== undefined && (typeof body[k] !== 'string' || body[k].length > 1000)) return bad(`${k} deve ter até 1000 caracteres.`);
    }
    s.retro = {
      id: s.retro?.id ?? db.newId('retro'),
      whatClicked: body.whatClicked ?? null,
      whatStuck: body.whatStuck ?? null,
      nextWeekWish: body.nextWeekWish ?? null,
      valuedItemId: body.valuedItemId ?? null,
      stuckItemId: body.stuckItemId ?? null,
      submittedAt: new Date().toISOString(),
    };
    db.feed.push({ id: db.newId('ev'), kind: 'posted_retro', at: new Date().toISOString(), member: db.ME, itemTitle: null });
    return { body: s.retro };
  }

  return undefined;
}
