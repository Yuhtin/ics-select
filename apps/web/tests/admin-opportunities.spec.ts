import { expect, test, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:3001';
const admin = {
  id: 'admin-1', name: 'Davi Admin', email: 'admin@ics.test', role: 'ADMIN', pictureUrl: null,
  privacyAcceptedAt: '2026-01-01T00:00:00Z', whatsappPhone: null, targetTrack: null, googleConnected: true,
};

const BASE_COCKPIT = {
  member: {
    id: 'u1',
    name: 'Maria Clara',
    email: 'maria.clara@sou.inteli.edu.br',
    pictureUrl: null,
    track: 'BIG_TECH',
    whatsappPhone: '5511999999999',
  },
  cycle: {
    id: 'cy1',
    name: '2026.2',
    weekNumber: 5,
    weeksTotal: 9,
    startsAt: '2026-03-30T00:00:00.000Z',
    endsAt: '2026-06-01T00:00:00.000Z',
  },
  range: 'cycle' as const,
  itemsCompleted: {
    total: 5,
    planned: 24,
    completionPct: 21,
    cohortMedian: 16,
    byOutcome: { DONE_EASY: 2, DONE_HARD: 1, DOUBTS: 1, STUCK: 1, PENDING: 19 },
    perWeek: [
      { weekStart: '2026-03-30', byOutcome: { DONE_EASY: 3, DONE_HARD: 1, DOUBTS: 0, STUCK: 0, PENDING: 0 } },
      { weekStart: '2026-04-06', byOutcome: { DONE_EASY: 1, DONE_HARD: 0, DOUBTS: 1, STUCK: 0, PENDING: 0 } },
      { weekStart: '2026-04-13', byOutcome: { DONE_EASY: 2, DONE_HARD: 0, DOUBTS: 0, STUCK: 1, PENDING: 0 } },
      { weekStart: '2026-04-20', byOutcome: { DONE_EASY: 0, DONE_HARD: 1, DOUBTS: 0, STUCK: 0, PENDING: 0 } },
      { weekStart: '2026-04-27', byOutcome: { DONE_EASY: 0, DONE_HARD: 0, DOUBTS: 0, STUCK: 0, PENDING: 0 } },
    ],
    needsAttention: { total: 2, stuck: 1, doubts: 1 },
  },
  timeInvested: {
    actualMinutes: 840,
    scheduledMinutes: 1440,
    cohortMedianMinutes: 1320,
    naoSeiCount: 2,
    perWeekMinutes: [300, 180, 240, 120, 0],
  },
  behavior: {
    sessions:        { value: 12, cohortMedian: 16, perWeek: [3, 4, 2, 2, 1] },
    daysActive:      { value: 9,  cycleDays: 35, cohortMedian: 12, perWeek: [3, 2, 2, 1, 1] },
    daysStudying:    { value: 6,  cycleDays: 35, cohortMedian: 11, perWeek: [2, 1, 1, 1, 1] },
    retros:          { submitted: 3, expected: 4 },
    carryOver:       { value: 3, cohortMedian: 1, perWeek: [0, 1, 1, 1, 0] },
    lastSeen:        { occurredAt: '2026-04-18T16:24:00.000Z', surface: '/me/plan' },
  },
  topicEngagement: [
    { topicId: 't1', label: 'Foundations',          minutes: 480, pctOfTotal: 57, itemsDone: 4, itemsPlanned: 6, cohortMedianMinutes: 480 },
    { topicId: 't2', label: 'Algorithms & DS',      minutes: 180, pctOfTotal: 21, itemsDone: 1, itemsPlanned: 8, cohortMedianMinutes: 300 },
    { topicId: 't3', label: 'Eng. Fundamentals',    minutes: 120, pctOfTotal: 14, itemsDone: 0, itemsPlanned: 5, cohortMedianMinutes: 180 },
    { topicId: 't4', label: 'SD · Building blocks', minutes: 60,  pctOfTotal: 7,  itemsDone: 0, itemsPlanned: 4, cohortMedianMinutes: 240 },
    { topicId: 't5', label: 'SD · Concepts',        minutes: 0,   pctOfTotal: 0,  itemsDone: 0, itemsPlanned: 3, cohortMedianMinutes: 120 },
    { topicId: 't6', label: 'SD · Case studies',    minutes: 0,   pctOfTotal: 0,  itemsDone: 0, itemsPlanned: 2, cohortMedianMinutes: 120 },
  ],
  classAttendance: {
    present: 5,
    total: 6,
    cohortPresent: 5,
    sessions: [
      { scheduledAt: '2026-03-06T18:00:00Z', status: 'PRESENT' as const },
      { scheduledAt: '2026-03-13T18:00:00Z', status: 'PRESENT' as const },
      { scheduledAt: '2026-03-20T18:00:00Z', status: 'PRESENT' as const },
      { scheduledAt: '2026-03-27T18:00:00Z', status: 'PRESENT' as const },
      { scheduledAt: '2026-04-03T18:00:00Z', status: 'ABSENT'  as const },
      { scheduledAt: '2026-04-10T18:00:00Z', status: 'PRESENT' as const },
    ],
  },
  firstSession: { occurredAt: '2026-03-04T08:00:00Z', dayOfCycle: 1 },
  recentActivity: [
    { occurredAt: '2026-04-18T16:24:00Z', type: 'OUTCOME_MARKED', meta: null, label: 'Marked outcome (STUCK)' },
    { occurredAt: '2026-04-18T16:00:00Z', type: 'PLAN_VIEW',      meta: null, label: 'Viewed plan' },
    { occurredAt: '2026-04-17T20:00:00Z', type: 'RETRO_SUBMITTED',meta: null, label: 'Submitted retro' },
    { occurredAt: '2026-04-15T14:30:00Z', type: 'OUTCOME_MARKED', meta: null, label: 'Marked outcome (DONE_EASY)' },
    { occurredAt: '2026-04-10T19:00:00Z', type: 'PLAN_VIEW',      meta: null, label: 'Viewed plan' },
  ],
};

const MOCK_ADMIN_MEMBER = {
  member: BASE_COCKPIT.member,
  cycle: BASE_COCKPIT.cycle,
  memberships: [
    {
      cycleId: 'cy1',
      cycleName: '2026.2',
      cycleStartsAt: BASE_COCKPIT.cycle.startsAt,
      cycleEndsAt: BASE_COCKPIT.cycle.endsAt,
      status: 'ACTIVE',
      isCurrent: true,
    },
  ],
  topicCoverage: BASE_COCKPIT.topicEngagement.map((t, i) => ({
    topicId: t.topicId,
    topicSlug: t.label.toLowerCase().replace(/\W+/g, '-'),
    topicLabel: t.label,
    order: i + 1,
    itemsPlanned: t.itemsPlanned,
    itemsDone: t.itemsDone,
    coveragePct: t.itemsPlanned ? Math.round((t.itemsDone / t.itemsPlanned) * 100) : 0,
  })),
  timeline: [],
  retros: [],
  attendance: [],
  planWeeks: {
    current: { weekStart: '2026-04-27', weekEnd: '2026-05-03', inCycle: true, planId: null, status: null },
    next:    { weekStart: '2026-05-04', weekEnd: '2026-05-10', inCycle: true, planId: null, status: null },
  },
};

const COCKPIT = { ...BASE_COCKPIT, risk: { status: 'ON_TRACK', reasons: [] }, engagement: null };

const base = {
  description: null, location: null, workMode: null, compensation: null, deadline: null, eventDate: null,
  links: [], contacts: [], createdAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-01T12:00:00Z',
  isOpen: true, interests: [], interestedByMe: false,
  createdBy: { id: 'admin-1', name: 'Davi Duarte', role: 'ADMIN' },
};
const list = [
  { ...base, id: 'draft1', title: 'Rascunho de vaga', type: 'FULL_TIME', companyName: 'Acme', status: 'DRAFT', publishedAt: null },
  {
    ...base, id: 'pub1', title: 'Estágio Nubank', type: 'INTERNSHIP', companyName: 'Nubank', status: 'PUBLISHED',
    publishedAt: '2026-11-01T12:00:00Z', deadline: '2026-11-30',
    interests: [{ userId: 'u2', name: 'Luana Melo', pictureUrl: null, createdAt: '2026-11-09T12:00:00Z' }],
  },
];

async function mock(page: Page, opts: { interested?: unknown[] | 'fail'; mutationsFail?: boolean } = {}) {
  await page.addInitScript(() => localStorage.setItem('ics_access_token', 'adm-token'));
  await page.route(`${API_BASE}/**`, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/me') return route.fulfill({ json: admin });
    if (url.pathname.endsWith('/cockpit')) return route.fulfill({ json: COCKPIT });
    if (url.pathname.endsWith('/mocks') || url.pathname.endsWith('/notes')) return route.fulfill({ json: [] });
    if (url.pathname.startsWith('/admin/member/')) return route.fulfill({ json: MOCK_ADMIN_MEMBER });
    if (url.pathname === '/opportunities' && req.method() === 'GET') {
      if (url.searchParams.get('interestedBy')) {
        return opts.interested === 'fail'
          ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL', message: 'x' } } })
          : route.fulfill({ json: opts.interested ?? [] });
      }
      return route.fulfill({ json: list });
    }
    if (opts.mutationsFail && url.pathname.startsWith('/opportunities/') && ['PATCH', 'DELETE'].includes(req.method())) {
      return route.fulfill({ status: 500, json: { error: { code: 'INTERNAL', message: 'boom' } } });
    }
    if (url.pathname.startsWith('/opportunities/') && req.method() === 'PATCH') {
      return route.fulfill({ json: { ...list[0], ...req.postDataJSON() } });
    }
    return route.fulfill({ json: {} });
  });
}

test('admin table lists drafts with status', async ({ page }) => {
  await mock(page);
  await page.goto('/admin/opportunities');
  const row = page.getByRole('row', { name: /Rascunho de vaga/ });
  await expect(row).toBeVisible();
  await expect(row.getByText('DRAFT')).toBeVisible();
  await expect(page.getByRole('row', { name: /Estágio Nubank/ }).getByText('PUBLISHED')).toBeVisible();
});

test('publish action PATCHes status PUBLISHED', async ({ page }) => {
  await mock(page);
  await page.goto('/admin/opportunities');
  const patch = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().endsWith('/opportunities/draft1'));
  await page.getByRole('row', { name: /Rascunho de vaga/ }).getByRole('button', { name: 'Publish' }).click();
  expect((await patch).postDataJSON()).toEqual({ status: 'PUBLISHED' });
});

test('interest count opens the member list', async ({ page }) => {
  await mock(page);
  await page.goto('/admin/opportunities');
  await page.getByRole('row', { name: /Estágio Nubank/ }).getByRole('button', { name: /1 interested/ }).click();
  await expect(page.getByText('Luana Melo')).toBeVisible();
});

test('member detail shows Interested in when the member flagged something', async ({ page }) => {
  await mock(page, { interested: [list[1]] });
  await page.goto('/admin/member/u2');
  await expect(page.getByRole('heading', { name: 'Maria Clara' })).toBeVisible();
  await expect(page.getByText('Interested in')).toBeVisible();
  await expect(page.getByText('Estágio Nubank')).toBeVisible();
});

test('member detail hides Interested in when empty', async ({ page }) => {
  await mock(page, { interested: [] });
  const asked = page.waitForResponse((r) => r.url().includes('interestedBy='));
  await page.goto('/admin/member/u2');
  await asked;
  await expect(page.getByRole('heading', { name: 'Maria Clara' })).toBeVisible();
  await expect(page.getByText('Interested in')).toHaveCount(0);
});

test('failed PATCH shows an error message', async ({ page }) => {
  await mock(page, { mutationsFail: true });
  await page.goto('/admin/opportunities');
  await page.getByRole('row', { name: /Rascunho de vaga/ }).getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not update' })).toBeVisible();
});

test('failed DELETE keeps the dialog open with the error', async ({ page }) => {
  await mock(page, { mutationsFail: true });
  await page.goto('/admin/opportunities');
  await page.getByRole('row', { name: /Rascunho de vaga/ }).getByRole('button', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(dialog.getByRole('alert').filter({ hasText: 'Could not delete' })).toBeVisible();
  await expect(dialog).toBeVisible();
});

test('member detail keeps Interested in hidden when the request fails', async ({ page }) => {
  await mock(page, { interested: 'fail' });
  const asked = page.waitForResponse((r) => r.url().includes('interestedBy='));
  await page.goto('/admin/member/u2');
  await asked;
  await expect(page.getByRole('heading', { name: 'Maria Clara' })).toBeVisible();
  await expect(page.getByText('Interested in')).toHaveCount(0);
});
