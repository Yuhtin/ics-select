/**
 * Playwright snapshot test for the redesigned plan editor.
 *
 * Mocked routes:
 *   GET /me                                       → admin user
 *   GET /plans/:id                                → DRAFT plan with 2 items
 *   GET /admin/member/:id/plan-context?weekStart  → context with carry-over,
 *                                                    availability slots, topics
 *   GET /topics                                   → topic list
 *   POST /plans/:id/preview-scheduling            → 2 placements
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

const WEEK_START = '2026-05-18T03:00:00.000Z';
const WEEK_END = '2026-05-25T03:00:00.000Z';

const PLAN_DRAFT = {
  id: 'plan-1',
  userId: 'u1',
  cycleId: 'cy1',
  weekStart: WEEK_START,
  weekEnd: WEEK_END,
  status: 'DRAFT',
  adminNotes: null,
  publishAt: null,
  sendWhatsapp: false,
  autoSchedule: true,
  items: [
    {
      id: 'wpi-1',
      libraryItemId: 'lib-A',
      order: 0,
      outcome: 'PENDING',
      skippable: false,
      scheduledAt: null,
      scheduledMinutes: null,
      libraryItem: {
        id: 'lib-A',
        title: 'Two-pointer technique',
        estimatedMinutes: 45,
        format: 'VIDEO',
        url: 'https://youtube.com/watch?v=fake1',
        topicId: 't1',
        topic: { id: 't1', slug: 'algorithms', label: 'Algorithms' },
        topics: [{ id: 't1', slug: 'algorithms', label: 'Algorithms', order: 1, isPrimary: true }],
        tags: [],
        tracks: [],
      },
    },
    {
      id: 'wpi-2',
      libraryItemId: 'lib-B',
      order: 1,
      outcome: 'PENDING',
      skippable: false,
      scheduledAt: null,
      scheduledMinutes: null,
      libraryItem: {
        id: 'lib-B',
        title: 'Binary search variants',
        estimatedMinutes: 30,
        format: 'ARTICLE',
        url: 'https://medium.com/fake2',
        topicId: 't1',
        topic: { id: 't1', slug: 'algorithms', label: 'Algorithms' },
        topics: [{ id: 't1', slug: 'algorithms', label: 'Algorithms', order: 1, isPrimary: true }],
        tags: [],
        tracks: [],
      },
    },
  ],
};

const PLAN_CONTEXT = {
  member: { id: 'u1', name: 'Maria Clara', pictureUrl: null, track: 'BIG_TECH' },
  cycle: { id: 'cy1', name: '2026.2', weekNumber: 5, weeksTotal: 9 },
  lastWeek: {
    weekStart: '2026-05-11',
    outcomes: { done_easy: 2, done_hard: 1, doubts: 1, stuck: 1, skipped: 0, pending: 0 },
    items: [],
  },
  carryOverCandidates: [
    {
      id: 'wpi-prev-1',
      libraryItemId: 'lib-prev-1',
      title: 'Graph traversal — BFS vs DFS',
      outcome: 'STUCK',
      reflection: 'A parte recursiva travou pra mim.',
      topicId: 't1',
      topicLabel: 'Algorithms',
      estimatedMinutes: 60,
    },
  ],
  retro: {
    whatClicked: 'Two-pointer ficou muito mais natural depois do exercício 3.',
    whatStuck: 'Recursão em árvore ainda me confunde.',
    nextWeekWish: 'Mais prática de árvore.',
    submittedAt: '2026-05-17T20:00:00.000Z',
    valuedItem: null,
    stuckItem: null,
  },
  topicCoverage: [
    { topicId: 't1', topicSlug: 'algorithms', topicLabel: 'Algorithms', order: 1, itemsPlanned: 6, itemsDone: 4, coveragePct: 67 },
    { topicId: 't2', topicSlug: 'data-structures', topicLabel: 'Data structures', order: 2, itemsPlanned: 4, itemsDone: 2, coveragePct: 50 },
  ],
  availability: {
    mondayMinutes: 90,
    tuesdayMinutes: 90,
    wednesdayMinutes: 60,
    thursdayMinutes: 0,
    fridayMinutes: 0,
    saturdayMinutes: 60,
    sundayMinutes: 0,
    preferredSessionMinutes: 45,
    weeklyBudgetMinutes: 300,
    timezone: 'America/Sao_Paulo',
    remainingCapacityMinutes: 240,
    daysRemaining: 4,
    slots: [
      { dayOfWeek: 0, startMinute: 17 * 60, endMinute: 19 * 60 },
      { dayOfWeek: 1, startMinute: 17 * 60, endMinute: 19 * 60 },
      { dayOfWeek: 2, startMinute: 18 * 60, endMinute: 19 * 60 },
      { dayOfWeek: 5, startMinute: 10 * 60, endMinute: 11 * 60 },
    ],
  },
  memberHistory: [],
};

const PREVIEW = {
  placements: [
    { itemId: 'lib-A', scheduledAt: '2026-05-18T20:00:00.000Z', durationMinutes: 45 },
    { itemId: 'lib-B', scheduledAt: '2026-05-19T20:00:00.000Z', durationMinutes: 30 },
  ],
  overflow: [],
  weekStart: WEEK_START,
  weekEnd: WEEK_END,
};

const TOPICS = [
  { id: 't1', slug: 'algorithms', label: 'Algorithms', order: 1 },
  { id: 't2', slug: 'data-structures', label: 'Data structures', order: 2 },
];

async function setupMocks(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('ics_access_token', 'fake-admin-token');
  });
  await page.route(new RegExp(`^${API_BASE}/me$`), (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ADMIN),
    }),
  );
  await page.route(new RegExp(`^${API_BASE}/plans/plan-1$`), (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PLAN_DRAFT),
    }),
  );
  await page.route(
    new RegExp(`^${API_BASE}/admin/member/[^/]+/plan-context`),
    (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PLAN_CONTEXT),
      }),
  );
  await page.route(new RegExp(`^${API_BASE}/topics$`), (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TOPICS),
    }),
  );
  await page.route(
    new RegExp(`^${API_BASE}/plans/plan-1/preview-scheduling$`),
    (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PREVIEW),
      }),
  );
}

test.describe('Plan editor', () => {
  test('DRAFT state renders context strip, editor, carry-over, week preview', async ({
    page,
  }) => {
    await setupMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/member/u1/plan/plan-1');
    await expect(page.getByText('Two-pointer technique').first()).toBeVisible();
    await expect(page.getByText('Semana · preview')).toBeVisible();
    // Wait for debounced preview to settle.
    await page.waitForTimeout(900);
    await expect(page).toHaveScreenshot('plan-editor-draft.png', {
      fullPage: true,
    });
  });
});
