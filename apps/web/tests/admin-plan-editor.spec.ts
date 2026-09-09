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

const LIBRARY_ITEM = {
  ...PLAN_DRAFT.items[0].libraryItem,
  id: 'lib-C',
  title: 'Sliding window practice',
  difficulty: 'MEDIUM',
  description: null,
  createdAt: '2026-05-01T00:00:00.000Z',
};

async function setupMocks(page: Page) {
  await page.addInitScript(() => {
    // Freeze Date only: Playwright's Intl clock shim conflicts with the
    // Temporal polyfill's DateTimeFormat wrapper used by the week preview.
    const fixedNow = new Date('2026-09-09T12:00:00.000Z').getTime();
    window.Date = new Proxy(Date, {
      construct(target, args) { return Reflect.construct(target, args.length ? args : [fixedNow]); },
      get(target, property, receiver) {
        return property === 'now' ? () => fixedNow : Reflect.get(target, property, receiver);
      },
    });
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
  await page.route(`${API_BASE}/library`, (route) => route.fulfill({ json: [LIBRARY_ITEM] }));
  await page.route(`${API_BASE}/library/lib-C`, (route) => route.fulfill({ json: LIBRARY_ITEM }));
}

test.describe('Plan editor', () => {
  test('DRAFT state renders context strip, editor, carry-over, week preview', async ({
    page,
  }) => {
    await setupMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/member/u1/plan/plan-1');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await expect(page.getByText('Two-pointer technique').first()).toBeVisible();
    await expect(page.getByText('Semana · preview')).toBeVisible();
    // Wait for debounced preview to settle.
    await page.waitForTimeout(900);
    await expect.soft(page).toHaveScreenshot('plan-editor-draft.png', {
      fullPage: true,
    });
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`library, item order, budget and publish options stay intact in ${theme}`, async ({ page }) => {
      await setupMocks(page);
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto('/admin/member/u1/plan/plan-1');
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      await expect(page.getByText('Planned 120 / 300 min (40%)')).toBeVisible();
      await expect(page.getByText('Fits remaining · 120 min headroom · 4 days left')).toBeVisible();
      await page.locator('#plan-item-lib-B').getByRole('button', { name: 'Move up' }).click();
      expect(await page.locator('[id^="plan-item-"]').evaluateAll((items) => items.map((item) => item.id))).toEqual(['plan-item-lib-B', 'plan-item-lib-A']);
      await page.getByRole('button', { name: 'Add from library', exact: true }).click();
      const picker = page.getByRole('dialog', { name: 'Add from library' });
      await expect(picker).toBeVisible();
      await expect(picker.getByText('Sliding window practice')).toBeVisible();
      await expect.soft(picker).toHaveScreenshot(`academy-library-picker-${theme}.png`);
      await picker.getByPlaceholder('Search title, url, topic, format…').fill('Sliding');
      await picker.getByRole('button', { name: /Sliding window practice/ }).click();
      await expect(picker.getByRole('button', { name: /Sliding window practice/ })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(picker).toHaveCount(0);
      await expect(page.locator('#plan-item-lib-C')).toBeVisible();
      await page.locator('#plan-item-lib-C').getByRole('button', { name: 'Remove' }).click();
      await expect(page.locator('#plan-item-lib-C')).toHaveCount(0);
      await page.locator('textarea').fill('Focar em algoritmos.');
      const saveRequest = page.waitForRequest((request) => request.url() === `${API_BASE}/plans/plan-1` && request.method() === 'PATCH');
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      expect((await saveRequest).postDataJSON()).toMatchObject({ adminNotes: 'Focar em algoritmos.', items: [{ libraryItemId: 'lib-B', order: 0 }, { libraryItemId: 'lib-A', order: 1 }] });
      await expect.soft(page).toHaveScreenshot(`academy-plan-editor-${theme}.png`, { fullPage: true });
      await page.getByRole('button', { name: 'Publish…', exact: true }).click();
      const publish = page.getByRole('dialog', { name: 'Publish plan' });
      await expect(publish.getByRole('radio', { name: 'Scheduled', exact: true })).toBeChecked();
      await expect(publish.getByLabel('Publish date and time')).toHaveValue('2026-05-18T07:00');
      await expect.soft(publish).toHaveScreenshot(`academy-publish-${theme}.png`);
      await publish.getByRole('radio', { name: 'Publish now', exact: true }).check();
      await expect(publish.getByLabel('Publish date and time')).toHaveCount(0);
      await publish.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(publish).toHaveCount(0);
    });

    test(`AI suggestions preserve the brief and add action in ${theme}`, async ({ page }) => {
      await setupMocks(page);
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.route(`${API_BASE}/ai/draft-plan`, (route) => route.fulfill({ json: { draft: {
        narrative: 'Praticar a técnica antes de avançar para árvores.',
        items: [{ libraryItemId: 'lib-C', order: 0, rationale: 'Reforça a prática da semana.' }],
        alternates: [], totalMinutes: 45,
      }, usage: {} } }));
      await page.goto('/admin/member/u1/plan/plan-1');
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      await page.getByRole('button', { name: 'Sugerir com IA' }).click();
      const drawer = page.getByRole('dialog');
      await drawer.getByPlaceholder('Ex: quero todos os vídeos de foundations.').fill('Mais prática de algoritmos');
      const request = page.waitForRequest(`${API_BASE}/ai/draft-plan`);
      await drawer.getByRole('button', { name: 'Gerar', exact: true }).click();
      expect((await request).postDataJSON()).toMatchObject({ memberId: 'u1', briefText: 'Mais prática de algoritmos' });
      await expect(drawer.getByText('Sliding window practice')).toBeVisible();
      await expect.soft(drawer).toHaveScreenshot(`academy-ai-suggestions-${theme}.png`);
      await drawer.getByRole('button', { name: 'Add →' }).click();
      await page.keyboard.press('Escape');
      await expect(page.locator('#plan-item-lib-C')).toBeVisible();
    });

    test(`publish scheduling shows pending and completed placements in ${theme}`, async ({ page }) => {
      await setupMocks(page);
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.route(`${API_BASE}/plans/plan-1/publish`, (route) => route.fulfill({ json: { plan: { ...PLAN_DRAFT, status: 'PUBLISHED' }, deferred: false } }));
      let finishScheduling!: () => void;
      const scheduling = new Promise<void>((resolve) => { finishScheduling = resolve; });
      await page.route(`${API_BASE}/plans/plan-1/auto-schedule`, async (route) => {
        await scheduling;
        await route.fulfill({ json: { placements: PREVIEW.placements.map((placement, index) => ({ ...placement, itemId: PLAN_DRAFT.items[index].id })), overflow: [], sessionsFailed: 0 } });
      });
      await page.goto('/admin/member/u1/plan/plan-1');
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      await page.getByRole('button', { name: 'Publish…', exact: true }).click();
      const publish = page.getByRole('dialog', { name: 'Publish plan' });
      await publish.getByRole('radio', { name: 'Publish now', exact: true }).check();
      const request = page.waitForRequest(`${API_BASE}/plans/plan-1/publish`);
      await publish.getByRole('button', { name: 'Publish now', exact: true }).click();
      expect((await request).postDataJSON()).toEqual({ publishAt: null, sendWhatsapp: false, autoSchedule: true });
      const modal = page.getByRole('dialog');
      await expect(modal.getByRole('heading', { name: 'Calculando e alocando…' })).toBeVisible();
      await expect.soft(modal).toHaveScreenshot(`academy-scheduling-pending-${theme}.png`);
      finishScheduling();
      await expect(modal.getByRole('heading', { name: 'Plano publicado' })).toBeVisible();
      await expect(modal.getByText('Mon, May 18 · 17:00 · 45 min')).toBeVisible();
      await expect(modal.getByText('Tue, May 19 · 17:00 · 30 min')).toBeVisible();
      await expect.soft(modal).toHaveScreenshot(`academy-scheduling-done-${theme}.png`);
    });

    test(`scheduling overflow preserves adjustment and force actions in ${theme}`, async ({ page }) => {
      await setupMocks(page);
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.route(`${API_BASE}/plans/plan-1/publish`, (route) => route.fulfill({ json: { plan: { ...PLAN_DRAFT, status: 'PUBLISHED' }, deferred: false } }));
      await page.route(`${API_BASE}/plans/plan-1/auto-schedule`, (route) => route.fulfill({ status: 409, json: {
        error: { code: 'PLAN_OVERFLOW', message: 'No available window', details: { overflow: [{ itemId: 'wpi-2', minutesRequired: 30 }] } },
      } }));
      await page.goto('/admin/member/u1/plan/plan-1');
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      await page.getByRole('button', { name: 'Publish…', exact: true }).click();
      const publish = page.getByRole('dialog', { name: 'Publish plan' });
      await publish.getByRole('radio', { name: 'Publish now', exact: true }).check();
      await publish.getByRole('button', { name: 'Publish now', exact: true }).click();
      const modal = page.getByRole('dialog');
      await expect(modal.getByText('1 item não couberam', { exact: true })).toBeVisible();
      await expect(modal.getByRole('button', { name: 'Forçar publicação' })).toBeEnabled();
      await expect(modal.getByRole('button', { name: 'Ajustar plano' })).toBeEnabled();
      await expect.soft(modal).toHaveScreenshot(`academy-scheduling-overflow-${theme}.png`);
      await modal.getByRole('button', { name: 'Ajustar plano' }).click();
      await expect(modal).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Apply changes', exact: true })).toBeVisible();
      await expect(page.locator('#plan-item-lib-A')).toBeVisible();
      await expect(page.locator('#plan-item-lib-B')).toBeVisible();
    });
  }
});
