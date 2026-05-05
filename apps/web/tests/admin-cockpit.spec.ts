/**
 * Playwright snapshot test for /admin/member/[id] cockpit.
 *
 * Mocked routes:
 *   GET /me                         → ADMIN user
 *   GET /admin/member/u1            → minimal MemberDetailResponse for raw-data accordion
 *   GET /admin/member/u1/cockpit*   → CockpitResponse (varies per test)
 *
 * Three states snapshotted: ON_TRACK, WATCH, AT_RISK.
 */

import { test, expect, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:3001';

const MOCK_ADMIN = {
  id: 'admin-1',
  email: 'admin@ics.test',
  name: 'Davi Admin',
  pictureUrl: null,
  role: 'ADMIN',
  privacyAcceptedAt: '2026-01-01T00:00:00.000Z',
  whatsappPhone: null,
  targetTrack: null,
  googleConnected: true,
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

function buildResponse(state: 'AT_RISK' | 'WATCH' | 'ON_TRACK') {
  if (state === 'AT_RISK') {
    return {
      ...BASE_COCKPIT,
      risk: {
        status: 'AT_RISK',
        reasons: ['14 days no session', '21% items completed', 'cohort bottom 25%'],
      },
      engagement: {
        score: 32,
        cohortMedian: 60,
        breakdown: [
          { label: 'Cohort rank',      value: 5,  weight: 25, status: 'bad' },
          { label: 'Days active',      value: 5,  weight: 20, status: 'bad' },
          { label: 'Plan completion',  value: 4,  weight: 20, status: 'bad' },
          { label: 'Retros submitted', value: 11, weight: 15, status: 'warn' },
        ],
        scoreByWeek: [70, 64, 52, 40, 32],
      },
    };
  }
  if (state === 'WATCH') {
    return {
      ...BASE_COCKPIT,
      itemsCompleted: { ...BASE_COCKPIT.itemsCompleted, total: 11, completionPct: 46, needsAttention: { total: 1, stuck: 0, doubts: 1 } },
      behavior: { ...BASE_COCKPIT.behavior, sessions: { value: 14, cohortMedian: 16, perWeek: [3, 3, 3, 3, 2] }, lastSeen: { occurredAt: new Date(Date.now() - 4 * 86400_000).toISOString(), surface: '/me/plan' } },
      risk: { status: 'WATCH', reasons: ['4 days no session', '46% items completed'] },
      engagement: {
        score: 55,
        cohortMedian: 60,
        breakdown: [
          { label: 'Cohort rank',      value: 12, weight: 25, status: 'warn' },
          { label: 'Days active',      value: 14, weight: 20, status: 'ok' },
          { label: 'Plan completion',  value: 9,  weight: 20, status: 'warn' },
          { label: 'Retros submitted', value: 11, weight: 15, status: 'warn' },
        ],
        scoreByWeek: [62, 60, 58, 55, 55],
      },
    };
  }
  // ON_TRACK
  return {
    ...BASE_COCKPIT,
    itemsCompleted: { ...BASE_COCKPIT.itemsCompleted, total: 18, completionPct: 75, needsAttention: { total: 0, stuck: 0, doubts: 0 } },
    behavior: {
      ...BASE_COCKPIT.behavior,
      sessions: { value: 22, cohortMedian: 16, perWeek: [4, 5, 4, 5, 4] },
      retros:   { submitted: 4, expected: 4 },
      carryOver:{ value: 0, cohortMedian: 1, perWeek: [0, 0, 0, 0, 0] },
      lastSeen: { occurredAt: new Date(Date.now() - 1 * 86400_000).toISOString(), surface: '/me/plan' },
    },
    risk: { status: 'ON_TRACK', reasons: [] },
    engagement: {
      score: 78,
      cohortMedian: 60,
      breakdown: [
        { label: 'Cohort rank',      value: 22, weight: 25, status: 'ok' },
        { label: 'Days active',      value: 18, weight: 20, status: 'ok' },
        { label: 'Plan completion',  value: 15, weight: 20, status: 'ok' },
        { label: 'Retros submitted', value: 15, weight: 15, status: 'ok' },
      ],
      scoreByWeek: [60, 65, 70, 74, 78],
    },
  };
}

async function setupMocks(page: Page, state: 'AT_RISK' | 'WATCH' | 'ON_TRACK') {
  await page.addInitScript(() => {
    window.localStorage.setItem('ics_access_token', 'fake-admin-token');
  });
  await page.route(new RegExp(`^${API_BASE}/me$`), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN) }),
  );
  await page.route(new RegExp(`^${API_BASE}/admin/member/[^/]+/cockpit`), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildResponse(state)) }),
  );
  await page.route(new RegExp(`^${API_BASE}/admin/member/[^/?]+(\\?.*)?$`), (r) => {
    if (r.request().url().includes('/cockpit')) return r.continue();
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN_MEMBER) });
  });
}

test.describe('Member cockpit', () => {
  test('AT_RISK state', async ({ page }) => {
    await setupMocks(page, 'AT_RISK');
    await page.goto('/admin/member/u1');
    await expect(page.getByText('AT RISK', { exact: true }).first()).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('cockpit-at-risk.png', { fullPage: true });
  });

  test('WATCH state', async ({ page }) => {
    await setupMocks(page, 'WATCH');
    await page.goto('/admin/member/u1');
    await expect(page.getByText('WATCH', { exact: true }).first()).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('cockpit-watch.png', { fullPage: true });
  });

  test('ON_TRACK state', async ({ page }) => {
    await setupMocks(page, 'ON_TRACK');
    await page.goto('/admin/member/u1');
    await expect(page.getByText('Maria Clara')).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page).toHaveScreenshot('cockpit-on-track.png', { fullPage: true });
  });
});
