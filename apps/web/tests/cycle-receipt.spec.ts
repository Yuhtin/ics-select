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
  engagementRanking: [
    { userId: 'u1', name: 'Alice', pictureUrl: null, score: 78 },
    { userId: 'u2', name: 'Bob', pictureUrl: null, score: 65 },
    { userId: 'u3', name: 'Carol', pictureUrl: null, score: 52 },
  ],
  streakChampion: { userId: 'u1', name: 'Alice', pictureUrl: null, streakDays: 5 },
  engagementLeader: { userId: 'u1', name: 'Alice', pictureUrl: null, score: 78 },
  mostHoursStudied: { userId: 'u1', name: 'Alice', pictureUrl: null, minutes: 360 },
  mostItemsCompleted: { userId: 'u1', name: 'Alice', pictureUrl: null, items: 8 },
  polymath: { userId: 'u2', name: 'Bob', pictureUrl: null, topics: 6 },
  mostActiveDays: { userId: 'u1', name: 'Alice', pictureUrl: null, days: 14 },
  marathonDay: { userId: 'u3', name: 'Carol', pictureUrl: null, date: '2026-05-04', items: 5 },
  longestItem: { userId: 'u1', name: 'Alice', pictureUrl: null, itemTitle: 'System Design Primer', minutes: 240 },
  perfectAttendance: [{ userId: 'u1', name: 'Alice', pictureUrl: null }],
};

async function setupMocks(page: Page, override?: Partial<typeof BASE_RECEIPT>) {
  await page.clock.setFixedTime(new Date('2026-09-09T12:00:00.000Z'));
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
  for (const theme of ['light', 'dark'] as const) {
    test(`receipt modes retain totals, export and print in ${theme}`, async ({ page }) => {
      await setupMocks(page);
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto('/admin/cycle/c1/receipt?mode=wrapped');
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      await expect(page.getByText('ACADEMY · FELLOW', { exact: true })).toBeVisible();
      await expect(page.getByText('8h 00m', { exact: true })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.soft(page).toHaveScreenshot(`academy-receipt-wrapped-${theme}.png`, { fullPage: true });
      await page.emulateMedia({ media: 'print' });
      const sections = page.locator('#receipt-capture-root > section');
      expect(await sections.evaluateAll((elements) => elements.every((element) =>
        getComputedStyle(element).backgroundColor.match(/\d+/g)!.slice(0, 3).every((value) => Number(value) > 240),
      ))).toBe(true);
      await expect.soft(page).toHaveScreenshot(`academy-receipt-wrapped-print-${theme}.png`, { fullPage: true });
      await page.emulateMedia({ media: 'screen' });
      await page.getByRole('button', { name: 'Switch to thermal' }).click();
      await page.waitForURL(/mode=thermal/);
      await expect(page.getByText('COHORT RECEIPT · CICLO 4')).toBeVisible();
      await expect(page.getByText('8h 00m', { exact: true })).toBeVisible();
      await expect(page.getByText('88%', { exact: true })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.soft(page).toHaveScreenshot(`academy-receipt-thermal-${theme}.png`, { fullPage: true });
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download PNG' }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('cycle-c1-receipt-2026-05-12.png');
      expect(await download.failure()).toBeNull();
      await page.emulateMedia({ media: 'print' });
      await expect.soft(page).toHaveScreenshot(`academy-receipt-thermal-print-${theme}.png`, { fullPage: true });
    });
  }

  test('renders thermal view by default', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/admin/cycle/c1/receipt');
    await expect(page.locator('#receipt-capture-root')).toBeVisible();
    await expect(page.getByText(/COHORT RECEIPT/)).toBeVisible();
    await expect(page.getByText('ACADEMY · FELLOW', { exact: true })).toBeVisible();
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

  test('wrapped mode renders Academy blocks when ?mode=wrapped', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/admin/cycle/c1/receipt?mode=wrapped');
    await expect(page.getByText(/together you studied/i)).toBeVisible();
    await expect(page.getByText(/hall of fame/i)).toBeVisible();
  });

  test('thermal paper stays light in a dark app and in print', async ({ page }) => {
    await setupMocks(page);
    await page.addInitScript(() => localStorage.setItem('ics-theme', 'dark'));
    await page.goto('/admin/cycle/c1/receipt');
    const paper = page.locator('#receipt-capture-root');
    await expect(paper).toBeVisible();
    const isLight = () => paper.evaluate((element) => {
      const channels = getComputedStyle(element).backgroundColor.match(/\d+/g)!;
      return channels.slice(0, 3).every((value) => Number(value) > 240);
    });
    expect(await isLight()).toBe(true);
    expect((await paper.boundingBox())!.width).toBe(720);
    await page.emulateMedia({ media: 'print' });
    expect(await isLight()).toBe(true);
    await expect(page.getByRole('button', { name: 'Download PNG' })).toBeHidden();
    expect((await paper.boundingBox())!.width).toBe(720);
  });

  test('receipt route does not render admin sidebar', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/admin/cycle/c1/receipt');
    await expect(page.locator('#receipt-capture-root')).toBeVisible();
    // AdminShell renders an aside; verify it's absent on this route.
    await expect(page.locator('aside.admin-sidebar, nav[aria-label="Admin sidebar"]')).toHaveCount(0);
  });
});
