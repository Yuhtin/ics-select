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
      '/me/home': {
        hero: { state: 'now', item }, today: [item], late: [], days: [], unscheduled: [],
        streak: { current: 7, last7: [true, true, true, true, true, true, true] },
        carryOverReflection: null, topicCoverage: [], studyTime: null,
      },
      '/me/cohort': { cycleName: '2026.2', memberCount: 0, members: [], ranking: [], feed: [] },
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
