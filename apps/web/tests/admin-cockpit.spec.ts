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
const FIXED_NOW = new Date('2026-09-09T12:00:00.000Z').getTime();

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
      behavior: { ...BASE_COCKPIT.behavior, sessions: { value: 14, cohortMedian: 16, perWeek: [3, 3, 3, 3, 2] }, lastSeen: { occurredAt: new Date(FIXED_NOW - 4 * 86400_000).toISOString(), surface: '/me/plan' } },
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
      lastSeen: { occurredAt: new Date(FIXED_NOW - 1 * 86400_000).toISOString(), surface: '/me/plan' },
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
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(() => {
    window.localStorage.setItem('ics_access_token', 'fake-admin-token');
  });
  await page.route(new RegExp(`^${API_BASE}/me$`), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN) }),
  );
  await page.route(new RegExp(`^${API_BASE}/admin/member/[^/]+/cockpit`), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildResponse(state)) }),
  );
  await page.route(new RegExp(`^${API_BASE}/admin/member/[^/]+/mocks`), (r) => r.fulfill({ json: [] }));
  await page.route(new RegExp(`^${API_BASE}/admin/member/[^/]+/notes`), (r) => r.fulfill({ json: [] }));
  await page.route(new RegExp(`^${API_BASE}/admin/member/[^/?]+(\\?.*)?$`), (r) => {
    if (r.request().url().includes('/cockpit')) return r.continue();
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN_MEMBER) });
  });
}

test.describe('Academy admin operations', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`waitlist course filters show hover feedback in ${theme}`, async ({ page }) => {
      await setupMocks(page, 'ON_TRACK');
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.route(`${API_BASE}/waitlist/config`, (route) => route.fulfill({ json: { cycleTarget: '2026.2', startsAt: null } }));
      await page.route(`${API_BASE}/admin/waitlist?*`, (route) => route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 50 } }));
      await page.route(`${API_BASE}/admin/waitlist/stats`, (route) => route.fulfill({ json: { total: 0, last7d: 0, byCourse: [], bySkill: [] } }));
      await page.goto('/admin/waitlist');
      const course = page.getByRole('button', { name: 'Ciência da Computação', exact: true });
      await expect(course).toHaveAttribute('aria-pressed', 'false');
      const restingBorder = await course.evaluate((element) => getComputedStyle(element).borderColor);
      await course.hover();
      await expect(course).not.toHaveCSS('border-color', restingBorder);
      await course.click();
      await expect(course).toHaveAttribute('aria-pressed', 'true');
    });

    test(`configuration tab shows keyboard focus in ${theme}`, async ({ page }) => {
      await setupMocks(page, 'ON_TRACK');
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.route(`${API_BASE}/admin/whatsapp/templates`, (route) => route.fulfill({ json: [] }));
      await page.goto('/admin/config');
      const tab = page.getByRole('button', { name: 'WhatsApp messages', exact: true });
      await page.keyboard.press('Tab');
      await tab.focus();
      await expect(tab).toBeFocused();
      await expect(tab).not.toHaveCSS('box-shadow', 'none');
    });

    test(`AI usage chart renders daily values in ${theme}`, async ({ page }) => {
      await setupMocks(page, 'ON_TRACK');
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.route(`${API_BASE}/ai/usage?*`, (route) => route.fulfill({ json: {
        totalCost: 0.12,
        rows: [1, 2].map((day) => ({
          id: `usage-${day}`, userId: 'u1', purpose: 'Plan generation', model: 'gpt-4.1',
          promptTokens: 1024, responseTokens: 247, costUsd: String(day * 0.04),
          createdAt: `2026-09-0${day}T12:00:00Z`, metadata: null,
        })),
      } }));
      await page.goto('/admin/ai-usage');
      const bars = page.locator('[title*="calls"]');
      await expect(bars).toHaveCount(2);
      const heights = await bars.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
      expect(heights[0]).toBeGreaterThan(0);
      expect(heights[1]).toBeCloseTo(heights[0] * 2, 0);
      const request = page.waitForRequest(`${API_BASE}/ai/usage?sinceDays=7`);
      await page.getByRole('button', { name: '7d', exact: true }).click();
      await request;
      await expect(bars).toHaveCount(2);
    });

    for (const width of [1440, 768]) {
      test(`members remain dense and operable in ${theme} at ${width}px`, async ({ page }) => {
        await setupMocks(page, 'ON_TRACK');
        await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
        await page.setViewportSize({ width, height: 960 });
        await page.route(`${API_BASE}/admin/dashboard`, (route) => route.fulfill({ json: [
          { ...MOCK_ADMIN, stats: { plansCount: 6, doneItems: 18, skippedItems: 1, stuckItems: 0 } },
          { ...BASE_COCKPIT.member, role: 'MEMBER', stats: { plansCount: 4, doneItems: 11, skippedItems: 0, stuckItems: 2 } },
        ] }));
        await page.route(`${API_BASE}/admin/invites`, (route) => route.fulfill({ json: [
          { id: 'invite-1', email: 'rafael.lima@sou.inteli.edu.br', role: 'MEMBER', createdAt: '2026-09-01T12:00:00Z', createdBy: MOCK_ADMIN, cycle: { id: 'cy1', name: '2026.2' } },
        ] }));
        await page.route(`${API_BASE}/cycles`, (route) => route.fulfill({ json: [
          { ...BASE_COCKPIT.cycle, status: 'ACTIVE', startsAt: '2026-08-01T00:00:00Z', endsAt: '2099-12-01T00:00:00Z' },
        ] }));
        await page.goto('/admin/members');
        await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
        await expect(page.getByRole('link', { name: 'Academy Fellow Admin', exact: true })).toBeVisible();
        await expect(page.getByText('rafael.lima@sou.inteli.edu.br', { exact: true })).toBeVisible();
        const invitation = page.getByText(/^Invited /);
        await expect(invitation).toHaveCSS('text-transform', 'none');
        const headingFont = await page.getByRole('heading', { name: 'Members', exact: true })
          .evaluate((element) => getComputedStyle(element).fontFamily);
        await expect(invitation).toHaveCSS('font-family', headingFont);
        await expect(page.getByRole('link', { name: /Maria Clara/ })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const navigation = page.getByRole('navigation', { name: 'Admin navigation' });
        expect(await navigation.getByRole('link').evaluateAll((links) =>
          new Set(links.map((link) => Math.round(link.getBoundingClientRect().top))).size,
        )).toBe(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page).toHaveScreenshot(`academy-admin-members-${theme}-${width}.png`, { fullPage: true });
        await page.getByPlaceholder('Search by name or email…').fill('maria');
        await expect(page.getByRole('link', { name: /Maria Clara/ })).toBeVisible();
        await expect(page.getByRole('main').getByRole('link', { name: /Davi Admin/ })).toHaveCount(0);
        await page.getByRole('button', { name: 'Revoke invite for rafael.lima@sou.inteli.edu.br' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('Revogar convite?', { exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      });
    }
  }
});

test.describe('Member cockpit', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const state of ['AT_RISK', 'WATCH', 'ON_TRACK'] as const) {
      test(`${state} keeps readable text and risk signals in ${theme}`, async ({ page }) => {
        await setupMocks(page, state);
        await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
        await page.setViewportSize({ width: 1440, height: 960 });
        await page.goto('/admin/member/u1');
        await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
        const indicator = page.getByRole('status', { name: 'Engagement risk' });
        await expect(indicator).toContainText(state.replace('_', ' '));
        await expect(indicator.locator('svg')).toBeVisible();
        const headingFont = await page.getByRole('heading', { name: 'Maria Clara' })
          .evaluate((element) => getComputedStyle(element).fontFamily);
        await expect(page.getByText('Items completed', { exact: true })).toHaveCSS('font-family', headingFont);
        await expect(page.getByText('Plan week', { exact: true })).toHaveCSS('font-family', headingFont);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect.soft(page).toHaveScreenshot(`academy-cockpit-${state.toLowerCase()}-${theme}.png`, { fullPage: true });
      });
    }

    test(`detail tabs and week picker remain usable on mobile in ${theme}`, async ({ page }) => {
      await setupMocks(page, 'WATCH');
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/admin/member/u1');
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      await expect(page.getByRole('status', { name: 'Member risk' })).toContainText('WATCH');
      await page.setViewportSize({ width: 768, height: 960 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const rangeRequest = page.waitForRequest((request) => request.url().includes('/cockpit?') && request.url().includes('range=7d'));
      await page.getByRole('button', { name: '7d', exact: true }).click();
      await rangeRequest;
      await expect(page.getByRole('button', { name: '7d', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.locator('summary').filter({ hasText: 'Raw data' }).click();
      const tabs = page.getByRole('navigation', { name: 'Member detail' });
      for (const [tab, empty] of [['Timeline', 'No plans yet.'], ['Retros', 'No retros submitted yet.'], ['Notes', 'No notes yet.'], ['Attendance', 'No classes scheduled in this cycle yet.']]) {
        await tabs.getByRole('button', { name: tab, exact: true }).click();
        await expect(tabs.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByText(empty, { exact: true })).toBeVisible();
      }
      await expect.soft(page).toHaveScreenshot(`academy-cockpit-tabs-${theme}-390.png`, { fullPage: true });
      await page.getByRole('button', { name: 'Plan week', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: /Current week/ })).toBeEnabled();
      await expect.soft(dialog).toHaveScreenshot(`academy-plan-week-${theme}-390.png`);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    });
  }

  for (const width of [1280, 390]) {
    test(`dark admin active navigation meets AA contrast at ${width}px`, async ({ page }) => {
      await setupMocks(page, 'ON_TRACK');
      await page.route(`${API_BASE}/admin/members`, (route) => route.fulfill({ json: [] }));
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(() => localStorage.setItem('ics-theme', 'dark'));
      await page.goto('/admin/members');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      const active = page.getByRole('navigation', { name: 'Admin navigation' })
        .getByRole('link', { name: 'Members', exact: true });
      await expect(active).toHaveAttribute('aria-current', 'page');
      const contrast = await active.evaluate((element) => {
        const luminance = (color: string) => {
          const [r, g, b] = color.match(/[\d.]+/g)!.slice(0, 3).map((value) => {
            const channel = Number(value) / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const style = getComputedStyle(element);
        const text = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
      });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });
  }

  test.afterEach(async ({ page }) => {
    await expect(page.getByText('Academy Fellow', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('ICS Select', { exact: true })).toHaveCount(0);
  });

  test('AT_RISK state', async ({ page }) => {
    await setupMocks(page, 'AT_RISK');
    await page.goto('/admin/member/u1');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await expect(page.getByText('AT RISK', { exact: true }).first()).toBeVisible();
    const riskBanner = page.getByRole('status', { name: 'Member risk' });
    await expect(riskBanner).toContainText('AT RISK');
    await expect(riskBanner.locator('svg')).toBeVisible();
    await expect(riskBanner).toContainText('14 days no session');
    await page.waitForTimeout(400);
    await expect.soft(page).toHaveScreenshot('cockpit-at-risk.png', { fullPage: true });
  });

  test('WATCH state', async ({ page }) => {
    await setupMocks(page, 'WATCH');
    await page.goto('/admin/member/u1');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await expect(page.getByText('WATCH', { exact: true }).first()).toBeVisible();
    const riskBanner = page.getByRole('status', { name: 'Member risk' });
    await expect(riskBanner).toContainText('WATCH');
    await expect(riskBanner.locator('svg')).toBeVisible();
    await expect(riskBanner).toContainText('4 days no session');
    await page.waitForTimeout(400);
    await expect.soft(page).toHaveScreenshot('cockpit-watch.png', { fullPage: true });
  });

  test('ON_TRACK state', async ({ page }) => {
    await setupMocks(page, 'ON_TRACK');
    await page.goto('/admin/member/u1');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await expect(page.getByText('Maria Clara')).toBeVisible();
    const riskIndicator = page.getByRole('status', { name: 'Engagement risk' });
    await expect(riskIndicator).toContainText('ON TRACK');
    await expect(riskIndicator.locator('svg')).toBeVisible();
    await expect(page.getByRole('status', { name: 'Member risk' })).toHaveCount(0);
    await page.waitForTimeout(400);
    await expect.soft(page).toHaveScreenshot('cockpit-on-track.png', { fullPage: true });
  });

  test('admin shell keeps all destinations accessible at desktop and mobile widths', async ({ page }) => {
    await setupMocks(page, 'ON_TRACK');
    await page.goto('/admin/member/u1');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    const header = page.getByRole('banner');
    for (const width of [1280, 1024, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const brandLink = header.getByRole('link', { name: 'Academy Fellow Admin', exact: true });
      expect((await brandLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      for (const [name, path] of [['Members', 'members'], ['Cycles', 'cycles'], ['Plans', 'plans'], ['Library', 'library'], ['Waitlist', 'waitlist'], ['Meetings', 'meetings'], ['Config', 'config']]) {
        const link = header.getByRole('link', { name, exact: true });
        await expect(link).toHaveAttribute('href', `/admin/${path}`);
        await link.focus();
        await expect(link).toBeFocused();
        await expect(link).not.toHaveCSS('box-shadow', 'none');
        expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      }
      await expect.poll(() => header.evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(header.getByRole('button', { name: 'Sign out' })).toBeVisible();
    }
    const theme = header.getByRole('button', { name: /Switch to .* theme/ });
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
