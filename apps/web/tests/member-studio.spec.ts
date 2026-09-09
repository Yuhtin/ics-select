import { expect, test, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:3001';
const member = {
  id: 'studio-member', name: 'Eduardo Santos', email: 'eduardo@test.com',
  role: 'MEMBER', pictureUrl: null, privacyAcceptedAt: '2026-01-01T00:00:00Z',
  whatsappPhone: '+5511999999999', targetTrack: 'BIG_TECH', googleConnected: true,
};
const item = {
  id: 'binary-search', planId: 'plan-1', order: 1, title: 'Binary search patterns',
  format: 'PROBLEM', estimatedMinutes: 45, url: 'https://leetcode.com/problems/binary-search',
  topic: { slug: 'binary-search', label: 'Binary Search' }, outcome: 'PENDING',
  skippable: true, scheduledAt: '2026-04-17T19:00:00Z', scheduledMinutes: 45,
  carriedFromItemId: null,
};

async function mockStudioMember(page: Page, retroOpen = true) {
  await page.addInitScript(() => localStorage.setItem('ics_access_token', 'studio-token'));
  await page.route(`${API_BASE}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const body: Record<string, unknown> = {
      '/me': member,
      '/me/calendar': {
        weekStart: '2026-04-12', weekEnd: '2026-04-18', timezone: 'America/Sao_Paulo', hasGoogleConnection: true,
        events: [
          { id: 'study-1', kind: 'ICS', title: item.title, start: '2026-04-17T19:00:00Z', end: '2026-04-17T19:45:00Z', allDay: false, ics: { ...item, itemId: item.id } },
          { id: 'external-1', kind: 'EXTERNAL', title: 'Mentor office hours', start: '2026-04-16T17:00:00Z', end: '2026-04-16T18:00:00Z', allDay: false, meetLink: 'https://meet.google.com/example', location: 'Campus' },
        ],
      },
      '/me/home': {
        hero: { state: 'now', item }, today: [item], late: [], days: [], unscheduled: [],
        streak: { current: 7, last7: [true, true, true, true, true, true, true] },
        carryOverReflection: null, topicCoverage: [
          { topicId: 'complexity', slug: 'complexity', label: 'Complexity', order: 0, itemsPlanned: 0, itemsDone: 0 },
          { topicId: 'hashing', slug: 'hashing', label: 'Hashing', order: 1, itemsPlanned: 4, itemsDone: 1 },
          { topicId: 'arrays', slug: 'arrays', label: 'Arrays', order: 2, itemsPlanned: 4, itemsDone: 2 },
          { topicId: 'recursion', slug: 'recursion', label: 'Recursion', order: 3, itemsPlanned: 4, itemsDone: 4 },
        ],
        studyTime: { actualMinutes: 90, estimatedMinutes: 120, itemsWithTime: 2, itemsTotal: 3 },
      },
      '/me/cohort': {
        cycleName: '2026.2', memberCount: 2,
        members: [
          { userId: member.id, name: member.name, email: member.email, pictureUrl: null, isMe: true },
          { userId: 'maria', name: 'Maria Oliveira', email: 'maria@example.com', pictureUrl: null, isMe: false },
        ],
        ranking: [
          { userId: 'maria', name: 'Maria Oliveira', pictureUrl: null, score: 92, isMe: false },
          { userId: member.id, name: member.name, pictureUrl: null, score: 88, isMe: true },
        ],
        feed: [
          { id: 'activity-1', kind: 'finished', at: '2026-04-17T18:00:00Z', member: { id: 'maria', name: 'Maria Oliveira', pictureUrl: null }, itemTitle: 'Recursion intro', itemId: 'recursion' },
        ],
      },
      '/me/retro/current': {
        open: retroOpen, retro: null, weekRecap: null,
        windowOpensAt: '2026-04-17T21:00:00Z', windowClosesAt: '2026-04-22T23:59:00Z',
      },
    };
    return route.fulfill({ json: body[path] ?? {} });
  });
}

test('Studio uses a labeled rail on desktop', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/me');
  const rail = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(rail).toBeVisible();
  expect((await rail.boundingBox())?.width).toBe(94);
  for (const label of ['Today', 'Calendar', 'Cohort', 'Retro', 'Theme', 'Settings', 'Profile', 'Sign out']) {
    await expect(rail.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(rail.getByRole('link', { name: 'Today', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('Studio uses bottom navigation and a Retro action on mobile', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/me');
  await expect(page.getByTestId('member-rail')).toBeHidden();
  const bottom = page.getByRole('navigation', { name: 'Main navigation' });
  for (const label of ['Today', 'Calendar', 'Cohort', 'Profile']) {
    await expect(bottom.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: /Retro open/i })).toHaveAttribute('href', '/me/retro');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Studio keeps mobile content clear of the Retro action and bottom navigation', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/me');

  const content = page.locator('main > div');
  const retro = page.getByRole('link', { name: /Retro open/i });
  const bottom = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(page.getByRole('heading', { name: 'Binary search patterns' })).toBeVisible();
  await expect(retro).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const [contentBox, retroBox, bottomBox] = await Promise.all([
    content.boundingBox(),
    retro.boundingBox(),
    bottom.boundingBox(),
  ]);

  expect(contentBox).not.toBeNull();
  expect(retroBox).not.toBeNull();
  expect(bottomBox).not.toBeNull();
  expect(contentBox!.y + contentBox!.height).toBeLessThanOrEqual(retroBox!.y);
  expect(retroBox!.y + retroBox!.height).toBeLessThanOrEqual(bottomBox!.y);
});

test('Studio keeps every rail action reachable in a short 200%-zoom desktop layout', async ({ page }) => {
  await mockStudioMember(page);
  // Models a 1600x900 display reduced to an 800x450 CSS viewport at 200% browser zoom.
  await page.setViewportSize({ width: 800, height: 450 });
  await page.goto('/me');

  const rail = page.getByTestId('member-rail');
  const navigation = rail.getByRole('navigation', { name: 'Main navigation' });
  const signOut = navigation.getByRole('button', { name: 'Sign out' });
  // Auth and the Retro query add actions after the initial shell render.
  await expect(signOut).toBeVisible();
  await expect(navigation.getByRole('link', { name: /Retro open/i })).toBeVisible();
  const targets = await navigation.locator('a, button').all();
  for (const target of targets) {
    expect(await target.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await target.evaluate((element) => element.scrollIntoView({ block: 'nearest' }));
    const reachable = await target.evaluate((element) => {
      const targetRect = element.getBoundingClientRect();
      const navigationRect = element.closest('nav')!.getBoundingClientRect();
      return targetRect.top >= navigationRect.top && targetRect.bottom <= navigationRect.bottom;
    });
    expect.soft(reachable, (await target.textContent())?.trim()).toBe(true);
  }

  expect(await navigation.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(signOut).toBeVisible();
});

test('Today uses an open focus band and divided context rail', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/me');
  const focus = page.getByTestId('current-focus');
  await expect(focus).toBeVisible();
  await expect(focus).toHaveCSS('border-left-width', '4px');
  await expect(focus).toHaveCSS('border-top-width', '0px');
  const context = page.getByTestId('studio-context-rail');
  await expect(context).toHaveCSS('border-left-width', '1px');
  await expect(page.getByText('LeetCode', { exact: true })).toBeVisible();
  await expect(context.getByText('Top 3 · Cohort')).toBeVisible();
  await expect(context.getByText('Study time this week')).toBeVisible();
  await expect(page.locator('[data-metadata-pill]')).toHaveCount(0);
});

test('Cohort separates roster and activity without a card grid', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/me/cohort');
  await expect(page.getByTestId('cohort-roster')).toBeVisible();
  await expect(page.getByTestId('studio-context-rail')).toHaveCSS('border-left-width', '1px');
  await expect(page.getByTestId('cohort-member-me')).toHaveCSS('border-left-width', '3px');
  await expect(page.getByText('Recursion intro')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const rosterBox = await page.getByTestId('cohort-roster').boundingBox();
  const activityBox = await page.getByTestId('cohort-activity').boundingBox();
  expect(rosterBox).not.toBeNull();
  expect(activityBox).not.toBeNull();
  expect(rosterBox!.y + rosterBox!.height).toBeLessThanOrEqual(activityBox!.y);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const theme of ['light', 'dark'] as const) {
  test(`Today uses neutral aggregate metrics and preserves reference defaults in ${theme}`, async ({ page }) => {
    await mockStudioMember(page);
    await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
    await page.goto('/me');
    const context = page.getByTestId('studio-context-rail');
    const study = context.locator('section').filter({ has: page.getByText('Study time this week', { exact: true }) });
    const coverage = context.locator('section').filter({ has: page.getByText('Topic coverage', { exact: true }) });
    await expect(study).toBeVisible();
    await expect(coverage).toBeVisible();
    await expect.soft(study.locator('[class*="bg-primary"]')).toHaveCount(0);
    await expect.soft(coverage.locator('[class*="bg-primary"]')).toHaveCount(0);
    const neutral = await study.getByText('Study time this week').evaluate((element) => getComputedStyle(element).color);
    await expect.soft(study.locator('[style]')).toHaveCSS('background-color', neutral);
    await expect(coverage.getByTitle('Hashing — 1/4')).toHaveClass(/bg-fg-mute\/25/);
    await expect(coverage.getByTitle('Arrays — 2/4')).toHaveClass(/bg-fg-mute\/65/);
    await expect(coverage.getByTitle('Recursion — 4/4')).toHaveClass(/bg-success/);
    await expect(coverage.getByTitle('Complexity — 0/0')).toHaveClass(/bg-bg-subtle/);

    await page.goto('/dev/me-preview');
    const referenceStudy = page.locator('section').filter({ has: page.getByText('Study time this week', { exact: true }) });
    await expect(referenceStudy.locator('[style]')).toHaveClass(/bg-primary/);
    await expect(page.getByTitle('Hashing — 1/4')).toHaveClass(/bg-primary\/25/);
    await expect(page.getByTitle('Arrays — 4/6')).toHaveClass(/bg-primary\/65/);
    await expect(page.getByTitle('Recursion — 4/4')).toHaveClass(/bg-success/);
  });
}

for (const width of [390, 1440]) {
  test(`Calendar makes the week grid the primary planning surface at ${width}px`, async ({ page }) => {
    await mockStudioMember(page);
    // Freeze only Date: the Playwright clock's Intl shim conflicts with temporal-polyfill/global.
    await page.addInitScript(() => {
      const NativeDate = Date;
      const fixed = NativeDate.parse('2026-04-17T19:00:00Z');
      window.Date = class extends NativeDate {
        constructor(...args: ConstructorParameters<typeof Date>) {
          super(...(args.length ? args : [fixed]));
        }
        static now() { return fixed; }
      } as DateConstructor;
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/me/calendar');
    const workspace = page.getByTestId('calendar-workspace');
    await expect(workspace).toBeVisible();
    const agenda = page.getByTestId('calendar-agenda');
    await expect(agenda).toHaveCSS(width >= 1024 ? 'border-right-width' : 'border-bottom-width', '1px');
    await expect(workspace.getByRole('heading', { level: 1 })).toHaveText('Apr 12 to Apr 18');
    await expect(page.getByText('Binary search patterns', { exact: true }).last()).toBeVisible();
    await expect(agenda.getByRole('link', { name: /Binary search patterns/ })).toHaveAttribute('href', '/me/item/binary-search');
    for (const name of ['Today', 'Previous week', 'Next week']) {
      const control = workspace.getByRole('button', { name, exact: true });
      expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await control.focus();
      await expect(control).not.toHaveCSS('box-shadow', 'none');
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
