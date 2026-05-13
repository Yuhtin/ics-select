/**
 * Playwright test for /admin/cycle/[id]/receipt.
 *
 * Mocks:
 *   GET /me                                → ADMIN user
 *   GET /admin/cycle/c1/receipt*           → CycleReceiptResponse fixture
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

const BASE_RECEIPT = {
  cycle: {
    id: 'c1',
    name: 'Ciclo 4',
    weekNumber: 4,
    weeksTotal: 8,
    startsAt: '2026-04-13T00:00:00.000Z',
    endsAt: '2026-06-08T00:00:00.000Z',
    status: 'ACTIVE' as const,
  },
  asOf: '2026-05-12T00:00:00.000Z',
  mode: 'thermal' as const,
  totals: {
    members: 4,
    totalMinutes: 480,
    avgMinutesPerMember: 120,
    itemsCompleted: 12,
    retros: 3,
    classesHeld: 2,
    classesTotal: 8,
    attendanceRate: 0.875,
  },
  byTopic: [
    { topicId: 't1', slug: 'hashmap', label: 'Hashmap', order: 1, membersReached: 4, itemsCompleted: 6, coveragePct: 1 },
    { topicId: 't2', slug: 'tree', label: 'Tree', order: 2, membersReached: 3, itemsCompleted: 4, coveragePct: 0.75 },
    { topicId: 't3', slug: 'graph', label: 'Graph', order: 3, membersReached: 2, itemsCompleted: 2, coveragePct: 0.5 },
  ],
  knowledgeGrid: {
    members: [
      { userId: 'u1', name: 'Alice', pictureUrl: null },
      { userId: 'u2', name: 'Bob', pictureUrl: null },
      { userId: 'u3', name: 'Carol', pictureUrl: null },
      { userId: 'u4', name: 'David', pictureUrl: null },
    ],
    topics: [
      { topicId: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 },
      { topicId: 't2', slug: 'tree', label: 'Tree', order: 2 },
      { topicId: 't3', slug: 'graph', label: 'Graph', order: 3 },
    ],
    cells: [
      { userId: 'u1', topicId: 't1', itemsDone: 2, hasStuckOrDoubts: false },
      { userId: 'u1', topicId: 't2', itemsDone: 1, hasStuckOrDoubts: false },
      { userId: 'u2', topicId: 't1', itemsDone: 2, hasStuckOrDoubts: false },
      { userId: 'u3', topicId: 't1', itemsDone: 1, hasStuckOrDoubts: true },
      { userId: 'u4', topicId: 't1', itemsDone: 1, hasStuckOrDoubts: false },
      { userId: 'u4', topicId: 't3', itemsDone: 2, hasStuckOrDoubts: false },
    ],
  },
  topMovers: [
    { userId: 'u1', name: 'Alice', pictureUrl: null, deltaItems: 4, topTopics: ['Hashmap', 'Tree'] },
    { userId: 'u2', name: 'Bob', pictureUrl: null, deltaItems: 3, topTopics: ['Hashmap'] },
  ],
  cycleTopMover: {
    userId: 'u1',
    name: 'Alice',
    pictureUrl: null,
    deltaItems: 6,
    topTopics: ['Hashmap', 'Tree', 'Graph'],
  },
  streakChampion: { userId: 'u1', name: 'Alice', pictureUrl: null, streakDays: 5 },
  engagementLeader: { userId: 'u1', name: 'Alice', pictureUrl: null, score: 78 },
  mostHoursStudied: { userId: 'u1', name: 'Alice', pictureUrl: null, minutes: 360 },
  mostItemsCompleted: { userId: 'u1', name: 'Alice', pictureUrl: null, items: 8 },
  perfectAttendance: [{ userId: 'u1', name: 'Alice', pictureUrl: null }],
};

async function setupMocks(page: Page, override?: Partial<typeof BASE_RECEIPT>) {
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
  await page.route(new RegExp(`^${API_BASE}/admin/cycle/[^/]+/receipt`), (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...BASE_RECEIPT, ...override }),
    }),
  );
}

test.describe('Cycle receipt', () => {
  test('renders thermal view by default', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/admin/cycle/c1/receipt');
    await expect(page.locator('#receipt-capture-root')).toBeVisible();
    await expect(page.getByText(/COHORT RECEIPT/)).toBeVisible();
    await expect(page.getByText(/CICLO 4/)).toBeVisible();
    await expect(page.getByText('Alice').first()).toBeVisible();
  });

  test('date picker updates asOf in URL', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/admin/cycle/c1/receipt');
    const input = page.locator('input[type="date"]');
    await expect(input).toBeVisible();
    await input.fill('2026-05-01');
    await page.waitForURL(/asOf=2026-05-01/);
  });

  test('wrapped mode renders gradient blocks when ?mode=wrapped', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/admin/cycle/c1/receipt?mode=wrapped');
    await expect(page.getByText(/together you studied/i)).toBeVisible();
    await expect(page.getByText(/hall of fame/i)).toBeVisible();
  });

  test('receipt route does not render admin sidebar', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/admin/cycle/c1/receipt');
    await expect(page.locator('#receipt-capture-root')).toBeVisible();
    // AdminShell renders an aside; verify it's absent on this route.
    await expect(page.locator('aside.admin-sidebar, nav[aria-label="Admin sidebar"]')).toHaveCount(0);
  });
});
