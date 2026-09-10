import { expect, test, type Page } from '@playwright/test';
import type { ItemResponse } from '../lib/queries/me-item';

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

const itemDetail: ItemResponse = {
  id: item.id, planId: item.planId, order: item.order, outcome: 'PENDING',
  skippable: true, reflection: null, completedAt: null,
  scheduledAt: item.scheduledAt, scheduledMinutes: item.scheduledMinutes,
  libraryItem: {
    id: 'library-binary-search', title: item.title, format: item.format,
    estimatedMinutes: item.estimatedMinutes, url: item.url, topic: item.topic,
    description: 'Practice classic, lower-bound, and upper-bound binary search.',
  },
  carriedFrom: null,
};

async function mockStudioMember(page: Page, retroOpen = true) {
  await freezeStudioDate(page);
  await page.addInitScript(() => localStorage.setItem('ics_access_token', 'studio-token'));
  await page.route(`${API_BASE}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const body: Record<string, unknown> = {
      '/me': member,
      '/me/item/binary-search': itemDetail,
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
  await expect.poll(async () => (await rail.boundingBox())?.width).toBe(94);
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
    expect(await target.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
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
  test(`Today and the Studio preview use neutral aggregate metrics in ${theme}`, async ({ page }) => {
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
    await expect(referenceStudy.locator('[style]')).toHaveClass(/bg-fg-mute/);
    await expect(page.getByTitle('Hashing — 1/4')).toHaveClass(/bg-fg-mute\/25/);
    await expect(page.getByTitle('Arrays — 4/6')).toHaveClass(/bg-fg-mute\/65/);
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


test('Item outcome asks one decision at a time and keeps the existing payload', async ({ page }) => {
  await mockStudioMember(page);
  const writes: unknown[] = [];
  await page.route(`${API_BASE}/plans/plan-1/items/binary-search/outcome`, async (route) => {
    const payload = route.request().postDataJSON();
    writes.push(payload);
    await route.fulfill({ json: { ...itemDetail, ...payload } });
  });
  await page.goto('/me/item/binary-search');
  await expect(page.getByTestId('item-focus-header')).toHaveCSS('border-left-width', '4px');
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'How did it go?' }).click();
  await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Save outcome', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Nailed it', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const reflection = page.getByRole('textbox', { name: /nota/i });
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await reflection.fill('Entendi o invariante.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const minutes = page.getByRole('spinbutton', { name: 'Tempo gasto (min)' });
  await expect(reflection).toHaveCount(0);
  await minutes.fill('0');
  await expect(page.getByText('Use um número inteiro entre 1 e 1440.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save outcome' })).toBeDisabled();
  await minutes.fill('45');
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Save outcome' }).click();
  await expect.poll(() => writes).toEqual([{ outcome: 'DONE_EASY', reflection: 'Entendi o invariante.', actualMinutes: 45 }]);
  await expect(page.getByRole('button', { name: 'Exit outcome editor' })).toHaveCount(0);
});

test('Item outcome keeps answers on failure, exit and retry', async ({ page }) => {
  await mockStudioMember(page);
  let fail = true;
  await page.route(`${API_BASE}/plans/plan-1/items/binary-search/outcome`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({ status: fail ? 500 : 200, json: fail ? { error: { code: 'INTERNAL', message: 'Could not save outcome.' } } : { ...itemDetail, ...route.request().postDataJSON() } });
  });
  await page.goto('/me/item/binary-search');
  await page.getByRole('button', { name: 'How did it go?' }).click();
  await page.getByRole('button', { name: 'Got it (hard)', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('textbox', { name: /nota/i }).fill('A resposta fica aqui.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const minutes = page.getByRole('spinbutton', { name: 'Tempo gasto (min)' });
  await minutes.fill('38');
  await page.getByRole('button', { name: 'Save outcome' }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await expect(minutes).toHaveValue('38');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Could not save outcome.');
  await expect(minutes).toHaveValue('38');
  await page.getByRole('button', { name: 'Previous question' }).click();
  await expect(page.getByRole('textbox', { name: /nota/i })).toHaveValue('A resposta fica aqui.');
  await page.getByRole('button', { name: 'Exit outcome editor' }).click();
  await page.getByRole('button', { name: 'How did it go?' }).click();
  await expect(page.getByRole('button', { name: 'Got it (hard)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /nota/i })).toHaveValue('A resposta fica aqui.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(minutes).toHaveValue('38');
  await minutes.fill('39');
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Save outcome' }).click();
  await expect(page.getByRole('button', { name: 'Exit outcome editor' })).toHaveCount(0);
});


test('Item outcome preserves skip, undo, completed edit and optimistic item state', async ({ page }) => {
  await mockStudioMember(page);
  let stored: ItemResponse = { ...itemDetail };
  let release: (() => void) | undefined;
  let writes = 0;
  await page.route(`${API_BASE}/me/item/binary-search`, (route) => route.fulfill({ json: stored }));
  await page.route(`${API_BASE}/plans/plan-1/items/binary-search/outcome`, async (route) => {
    writes += 1;
    const payload = route.request().postDataJSON();
    if (payload.outcome === 'SKIPPED') await new Promise<void>((resolve) => { release = resolve; });
    stored = { ...stored, ...payload };
    await route.fulfill({ json: stored });
  });
  await page.goto('/me/item/binary-search');
  await page.getByRole('button', { name: 'How did it go?' }).click();
  await page.getByRole('button', { name: 'Already known', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  const skipRequest = page.waitForRequest((request) => request.method() === 'PATCH');
  await page.getByRole('button', { name: 'Save outcome' }).click();
  expect((await skipRequest).postDataJSON()).toEqual({ outcome: 'SKIPPED', actualMinutes: null });
  // Cache flips to a completed marker before the server resolves, but the active answer stays visible.
  await expect(page.getByTestId('item-focus-header')).toHaveClass(/border-l-success/);
  await expect(page.getByRole('button', { name: 'Already known', exact: true })).toHaveAttribute('aria-pressed', 'true');
  release!();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  const undoRequest = page.waitForRequest((request) => request.method() === 'PATCH');
  await page.getByRole('button', { name: 'Undo' }).click();
  expect((await undoRequest).postDataJSON()).toEqual({ outcome: 'PENDING', actualMinutes: null });
  await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Already known', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Stuck', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('textbox', { name: /nota/i }).fill('Preciso de ajuda com o invariante.');
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  const stuckRequest = page.waitForRequest((request) => request.method() === 'PATCH');
  await page.getByRole('button', { name: 'Save outcome' }).click();
  expect((await stuckRequest).postDataJSON()).toEqual({ outcome: 'STUCK', reflection: 'Preciso de ajuda com o invariante.', actualMinutes: null });
  await expect(page.getByText('Stuck — help requested')).toBeVisible();
  await expect(page.getByText('The program director has been notified. Talk to them when you can.')).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stuck', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Already known', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /nota/i })).toHaveValue('Preciso de ajuda com o invariante.');
  await page.getByRole('button', { name: 'Previous question' }).click();
  await page.getByRole('button', { name: 'Not yet', exact: true }).click();
  await expect(page.getByText('1 of 1', { exact: true })).toBeVisible();
  const pendingRequest = page.waitForRequest((request) => request.method() === 'PATCH');
  await page.getByRole('button', { name: 'Save outcome' }).click();
  expect((await pendingRequest).postDataJSON()).toEqual({ outcome: 'PENDING', reflection: 'Preciso de ajuda com o invariante.', actualMinutes: null });
  await expect(page.getByRole('button', { name: 'How did it go?' })).toBeVisible();
  expect(writes).toBe(4);
});


for (const width of [390, 800]) {
  test(`Item outcome keeps keyboard focus and actions reachable at ${width}px`, async ({ page }) => {
    await mockStudioMember(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // 800x450 is the CSS viewport of a 1600x900 display at 200% browser zoom.
    await page.setViewportSize({ width, height: 450 });
    await page.goto('/me/item/binary-search');
    const entry = page.getByRole('button', { name: 'How did it go?' });
    await entry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Nailed it', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sua nota' })).toBeFocused();
    await page.keyboard.press('Tab');
    const reflection = page.getByRole('textbox', { name: /nota/i });
    await expect(reflection).toBeFocused();
    await page.keyboard.type('Long answers stay local.');
    await expect(reflection).toHaveValue('Long answers stay local.');
    await expect(page.locator('[data-guided-panel]')).toHaveCSS('transform', 'none');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('spinbutton').fill('1441');
    await expect(page.getByRole('button', { name: 'Save outcome' })).toBeDisabled();
    await page.getByRole('spinbutton').fill('45');
    const save = page.getByRole('button', { name: 'Save outcome' });
    await save.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(save).toBeInViewport();
    if (width < 768) {
      const action = await page.getByRole('link', { name: /Retro open/ }).boundingBox();
      const button = await save.boundingBox();
      expect(button!.y + button!.height).toBeLessThanOrEqual(action!.y);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}


for (const staleChoice of ['Not yet', 'Already known']) {
  test(`Item outcome ignores stale ${staleChoice} choice during the exit transition`, async ({ page }) => {
    await mockStudioMember(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const writes: unknown[] = [];
    await page.route(`${API_BASE}/plans/plan-1/items/binary-search/outcome`, async (route) => {
      const payload = route.request().postDataJSON();
      writes.push(payload);
      await route.fulfill({ json: { ...itemDetail, ...payload } });
    });
    await page.goto('/me/item/binary-search');
    await page.getByRole('button', { name: 'How did it go?' }).click();
    await page.getByRole('button', { name: 'Nailed it', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
    // Attempt both an immediate stale activation and one after React starts
    // the normal-motion exit. Neither can change the conditional step list.
    const outgoingStillMounted = await page.getByRole('button', { name: 'Continue', exact: true }).evaluate(async (button, label) => {
      const choice = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === label)!;
      (button as HTMLButtonElement).click();
      choice.click();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const stillMounted = choice.isConnected;
      choice.click();
      return stillMounted;
    }, staleChoice);
    expect(outgoingStillMounted).toBe(true);
    await expect(page.getByText('2 of 3', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sua nota' })).toBeFocused();
    await expect(page.getByRole('textbox', { name: /nota/i })).toBeVisible();
    await page.getByRole('button', { name: 'Previous question' }).click();
    await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Nailed it', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('1 of 3', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('textbox', { name: /nota/i }).fill('The original outcome remains selected.');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('spinbutton').fill('45');
    expect(writes).toEqual([]);
    await page.getByRole('button', { name: 'Save outcome' }).click();
    await expect.poll(() => writes).toEqual([{ outcome: 'DONE_EASY', reflection: 'The original outcome remains selected.', actualMinutes: 45 }]);
  });
}

for (const outcome of ['PENDING', 'DONE_EASY'] as const) {
  test(`Item outcome Exit restores keyboard focus for ${outcome}`, async ({ page }) => {
    await mockStudioMember(page);
    await page.route(`${API_BASE}/me/item/binary-search`, (route) => route.fulfill({ json: { ...itemDetail, outcome, reflection: 'Keep the existing answer.' } }));
    await page.goto('/me/item/binary-search');
    const entry = page.getByRole('button', { name: outcome === 'PENDING' ? 'How did it go?' : 'Edit', exact: true });
    await entry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeFocused();
    const exit = page.getByRole('button', { name: 'Exit outcome editor' });
    await exit.focus();
    await page.keyboard.press('Enter');
    await expect(entry).toBeFocused();
    // The replacement control is usable immediately, without restarting Tab at the page top.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeFocused();
    await page.getByRole('button', { name: 'Nailed it', exact: true }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('textbox', { name: /nota/i })).toHaveValue('Keep the existing answer.');
  });
}


test('reconnect gate uses the Studio canvas and keeps the OAuth target', async ({ page }) => {
  await mockStudioMember(page);
  await page.route(new RegExp(`^${API_BASE}/me$`), (route) => route.fulfill({ json: { ...member, googleConnected: false } }));
  await page.goto('/me');
  const gate = page.getByRole('heading', { name: 'Reconnect your Google Calendar' }).locator('..');
  await expect(gate).toBeVisible();
  await expect(gate).toHaveCSS('border-top-width', '0px');
  await expect(gate.getByRole('link', { name: 'Reconnect Google' })).toHaveAttribute('href', '/auth/google');
  await expect(page.getByRole('heading', { name: item.title })).toHaveCount(0);
});

test('guided member motion becomes static with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockStudioMember(page);
  await page.goto('/me/retro');
  await expect(page.getByRole('textbox')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length)).toBe(0);
});

test('Calendar query failure replaces loading with an open recovery message', async ({ page }) => {
  await mockStudioMember(page);
  await page.route(`${API_BASE}/me/calendar?*`, (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/me/calendar');
  const error = page.getByRole('main').getByRole('alert');
  await expect(error).toHaveText('Could not load your calendar.', { timeout: 15000 });
  await expect(page.getByText('Loading calendar')).toHaveCount(0);
});

test('Studio switches to 32px workspace padding at 1200px', async ({ page }) => {
  await mockStudioMember(page);
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/me');
  await expect(page.locator('main > div')).toHaveCSS('padding-left', '32px');
});

test('preview matches the authenticated navigation geometry without API requests', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  const requests: string[] = [];
  page.on('request', (request) => { if (request.url().startsWith(API_BASE)) requests.push(request.url()); });
  await page.goto('/dev/me-preview');
  const rail = page.getByTestId('member-rail');
  await expect(rail).toBeVisible();
  await expect.poll(async () => (await rail.boundingBox())?.width).toBe(94);
  for (const name of ['Today', 'Calendar', 'Cohort']) {
    const link = rail.getByRole('link', { name, exact: true });
    expect((await link.boundingBox())?.height).toBe(48);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(rail).toBeHidden();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const name of ['Today', 'Calendar', 'Cohort', 'Profile']) {
    expect((await nav.getByRole('link', { name, exact: true }).boundingBox())?.height).toBe(64);
  }
  expect(requests).toEqual([]);
});

test('short external Calendar events keep their full touch target and focus visible', async ({ page }) => {
  await mockStudioMember(page);
  await freezeStudioDate(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(`${API_BASE}/me/calendar?*`, (route) => route.fulfill({ json: {
    weekStart: '2026-04-12', weekEnd: '2026-04-18', timezone: 'America/Sao_Paulo', hasGoogleConnection: true,
    events: [35, 45].map((minutes, index) => ({ id: `short-${minutes}`, kind: 'EXTERNAL', title: `${minutes} minute meeting`, start: `2026-04-${16 + index}T17:00:00Z`, end: `2026-04-${16 + index}T17:${minutes}:00Z`, allDay: false, meetLink: `https://meet.google.com/short-${minutes}` })),
  } }));
  await page.goto('/me/calendar');
  for (const minutes of [35, 45]) {
    const link = page.locator(`a[href="https://meet.google.com/short-${minutes}"]`);
    await link.focus();
    await link.scrollIntoViewIfNeeded();
    await expect(link).not.toHaveCSS('box-shadow', 'none');
    const geometry = await link.evaluate((element) => {
      const box = element.getBoundingClientRect();
      let top = box.top, bottom = box.bottom, left = box.left, right = box.right;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const rect = parent.getBoundingClientRect();
        if (/(hidden|auto|scroll|clip)/.test(style.overflowY)) { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
        if (/(hidden|auto|scroll|clip)/.test(style.overflowX)) { left = Math.max(left, rect.left); right = Math.min(right, rect.right); }
      }
      return { width: right - left, height: bottom - top };
    });
    expect.soft(geometry.width).toBeGreaterThanOrEqual(44);
    expect.soft(geometry.height).toBeGreaterThanOrEqual(44);
  }
});

for (const width of [390, 1440]) {
  test(`consecutive and grid-start external events have disjoint usable destinations at ${width}px`, async ({ page }) => {
    await mockStudioMember(page);
    await page.setViewportSize({ width, height: 900 });
    const events = [
      { id: 'later', title: 'Second short meeting', start: '2026-04-16T17:35:00Z', end: '2026-04-16T18:10:00Z', htmlLink: 'https://calendar.google.com/event?eid=second' },
      { id: 'first', title: 'First short meeting', start: '2026-04-16T17:00:00Z', end: '2026-04-16T17:35:00Z', meetLink: 'https://meet.google.com/first' },
      { id: 'opening', title: 'Opening short meeting', start: '2026-04-16T10:00:00Z', end: '2026-04-16T10:35:00Z', meetLink: 'https://meet.google.com/opening' },
    ];
    await page.route(`${API_BASE}/me/calendar?*`, (route) => route.fulfill({ json: {
      weekStart: '2026-04-12', weekEnd: '2026-04-18', timezone: 'America/Sao_Paulo', hasGoogleConnection: true,
      events: events.map((event) => ({ ...event, kind: 'EXTERNAL', allDay: false })),
    } }));
    await page.goto('/me/calendar');
    const grid = page.getByTestId('calendar-grid-scroller');
    await expect(grid.getByText('First short meeting', { exact: true })).toBeVisible();
    // Test the visible target's center and all four corners. Bounding boxes
    // alone miss a later event intercepting the preceding event's action.
    for (const url of ['https://meet.google.com/first', 'https://calendar.google.com/event?eid=second', 'https://meet.google.com/opening']) {
      const link = page.locator(`a[href="${url}"]`);
      await link.scrollIntoViewIfNeeded();
      const hits = await link.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const points = [[box.left + 1, box.top + 1], [box.right - 1, box.top + 1], [box.left + 1, box.bottom - 1], [box.right - 1, box.bottom - 1], [box.left + box.width / 2, box.top + box.height / 2]];
        return { width: box.width, height: box.height, destinations: points.map(([x, y]) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href') ?? null) };
      });
      expect.soft(hits.width).toBeGreaterThanOrEqual(44);
      expect.soft(hits.height).toBeGreaterThanOrEqual(44);
      expect.soft(hits.destinations).toEqual([url, url, url, url, url]);
    }
    // External actions live outside the time-scaled blocks; their event titles
    // and chronological ordering explicitly associate agenda and grid.
    const agenda = page.getByTestId('calendar-agenda');
    await expect(agenda.getByRole('link')).toHaveText([
      /Opening short meeting.*07:00–07:35/s,
      /First short meeting.*14:00–14:35/s,
      /Second short meeting.*14:35–15:10/s,
    ]);
    for (const [title, expectedTop] of [['Opening short meeting', 0], ['First short meeting', 392], ['Second short meeting', 424.6667]] as const) {
      const block = grid.getByText(title, { exact: true }).locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " absolute ")][1]');
      const geometry = await block.evaluate((element) => ({ top: parseFloat((element as HTMLElement).style.top), height: parseFloat((element as HTMLElement).style.height) }));
      expect(geometry.top).toBeCloseTo(expectedTop, 2);
      expect(geometry.height).toBeCloseTo(32.6667, 2);
      await expect(block.locator('a, button, [tabindex]')).toHaveCount(0);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

async function freezeStudioDate(page: Page) {
  // Freeze Date alone: temporal-polyfill relies on the native Intl constructors.
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixed = NativeDate.parse('2026-04-17T19:00:00Z');
    window.Date = class extends NativeDate {
      constructor(...args: ConstructorParameters<typeof Date>) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    } as DateConstructor;
  });
}


test('onboarding uses guided progress and focuses each question in reduced motion', async ({ page }) => {
  await mockStudioMember(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(new RegExp(`^${API_BASE}/me$`), (route) => route.fulfill({ json: { ...member, targetTrack: null } }));
  await page.goto('/me/onboarding');
  await page.getByRole('textbox').fill('+5511987654321');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Which one are you shooting for?' })).toBeFocused();
  await expect(page.getByText('2 of 4', { exact: true })).toBeVisible();
  await expect(page.locator('[data-onboarding-panel]')).toHaveCSS('transform', 'none');
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length)).toBe(0);
});

test('onboarding phone question names its input and announces the described validation error', async ({ page }) => {
  await mockStudioMember(page);
  await page.route(new RegExp(`^${API_BASE}/me$`), (route) => route.fulfill({ json: { ...member, targetTrack: null } }));
  await page.goto('/me/onboarding');
  const phone = page.getByRole('textbox');
  await expect.soft(phone).toHaveAccessibleName('Where should we reach you?');
  const questionId = await page.getByRole('heading', { name: 'Where should we reach you?' }).getAttribute('id');
  expect.soft(questionId).toBeTruthy();
  if (questionId) await expect.soft(phone).toHaveAttribute('aria-labelledby', questionId);
  await phone.fill('+551');
  const error = page.getByText('E.164 format: + country code + number. Example: +5511999999999', { exact: true });
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await expect.soft(phone).toHaveAccessibleDescription('E.164 format: + country code + number. Example: +5511999999999');
  await expect.soft(error).toHaveAttribute('role', 'alert');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await phone.fill('+5511987654321');
  await expect(phone).not.toHaveAttribute('aria-invalid', 'true');
  await expect(phone).not.toHaveAttribute('aria-describedby');
  await expect(error).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
});


for (const width of [390, 768, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`Studio reference at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.goto('/dev/me-preview');
      await prepareStudioCapture(page, theme);
      await expect(page).toHaveScreenshot(`academy-studio-${theme}-${width}.png`, { fullPage: true, animations: 'disabled' });
    });

    for (const [route, path, title] of [
      ['today', '/me', 'Binary search patterns'],
      ['calendar', '/me/calendar', 'Apr 12 to Apr 18'],
      ['item', '/me/item/binary-search', 'Binary search patterns'],
      ['cohort', '/me/cohort', '2 classmates this cycle'],
      ['retro', '/me/retro', '1 coisa que você quer no próximo plano'],
    ]) {
      test(`Studio ${route} at ${width}px in ${theme}`, async ({ page }) => {
        await mockStudioMember(page);
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
        await page.goto(path);
        await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
        if (route === 'item') {
          await page.getByRole('button', { name: 'How did it go?' }).click();
          await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeFocused();
        }
        if (route === 'calendar') {
          await expect(page.getByTestId('calendar-grid-scroller').getByText('Mentor office hours')).toBeVisible();
          const scroller = page.getByTestId('calendar-grid-scroller');
          await expect(scroller).toHaveCSS('overflow-x', 'auto');
          if (width < 1024) await scroller.evaluate((element) => {
            element.scrollLeft = element.scrollWidth - element.clientWidth;
            element.querySelector<HTMLElement>('.overflow-y-auto')!.scrollTop = 280;
          });
        }
        await prepareStudioCapture(page, theme);
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(page).toHaveScreenshot(`academy-studio-${route}-${theme}-${width}.png`, { fullPage: true, animations: 'disabled' });
      });
    }
  }
}

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`Studio reconnect at ${width}px in ${theme}`, async ({ page }) => {
      await mockStudioMember(page);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.route(new RegExp(`^${API_BASE}/me$`), (route) => route.fulfill({ json: { ...member, googleConnected: false } }));
      await page.goto('/me');
      const gate = page.getByTestId('google-reconnect-gate');
      await expect(gate).toBeVisible();
      await expect(gate.getByRole('link', { name: 'Reconnect Google' })).toHaveAttribute('href', '/auth/google');
      await expect(page.getByRole('heading', { name: item.title })).toHaveCount(0);
      await prepareStudioCapture(page, theme);
      await expect(page).toHaveScreenshot(`academy-studio-reconnect-${theme}-${width}.png`, { fullPage: true, animations: 'disabled' });
    });

    test(`Studio onboarding at ${width}px in ${theme}`, async ({ page }) => {
      await mockStudioMember(page);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.route(new RegExp(`^${API_BASE}/me$`), (route) => route.fulfill({ json: { ...member, targetTrack: null, googleConnected: false } }));
      await page.goto('/me');
      await expect(page).toHaveURL(/\/me\/onboarding$/);
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Reconnect Google' })).toHaveCount(0);
      for (const [index, title] of ['Where should we reach you?', 'Which one are you shooting for?', 'How much time per day?', 'Dark or light?'].entries()) {
        const heading = page.getByRole('heading', { name: title, exact: true });
        await expect(heading).toBeVisible();
        if (index > 0) await expect(heading).toBeFocused();
        if (index === 0) await page.getByRole('textbox').fill('+5511987654321');
        if (index === 1) await page.getByRole('button', { name: /^Big Tech/ }).click();
        await prepareStudioCapture(page, theme);
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(page).toHaveScreenshot(`academy-studio-onboarding-${index + 1}-${theme}-${width}.png`, { fullPage: true, animations: 'disabled' });
        if (index < 3) await page.getByRole('button', { name: 'Next', exact: true }).click();
      }
      await expect(page.getByRole('button', { name: "LET'S GOOOO" })).toBeEnabled();
    });
  }
}

async function prepareStudioCapture(page: Page, theme: 'light' | 'dark') {
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('Retro response remains reachable at 200 percent mobile zoom', async ({ page }) => {
  await mockStudioMember(page);
  // 780x1688 at 200% browser zoom yields a 390x844 CSS viewport. Unlike pinch
  // magnification, browser zoom reflows the layout and is the spec's contract.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/me/retro');
  const response = page.getByRole('textbox');
  await response.focus();
  await response.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const bounds = await response.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  const navigation = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(navigation!.y);
  await response.fill('A resposta continua acessível com o teclado aberto.');
  // A reduced visual height models the keyboard reserving the lower viewport.
  await page.setViewportSize({ width: 390, height: 450 });
  const submit = page.getByRole('button', { name: 'Submit retro', exact: true });
  for (const control of [response, submit]) {
    await control.focus();
    await control.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const box = await control.boundingBox();
    const bottomBar = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(bottomBar!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(450);
    await expect(control).toBeFocused();
  }
  await expect(submit).toBeEnabled();
  await expect(response).toHaveValue('A resposta continua acessível com o teclado aberto.');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('onboarding preserves its ordered writes, answers on Back, and final redirect', async ({ page }) => {
  await mockStudioMember(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let finished = false;
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  await page.route(new RegExp(`^${API_BASE}/me$`), (route) => route.fulfill({ json: { ...member, targetTrack: finished ? 'BIG_TECH' : null } }));
  for (const path of ['/me/profile', '/me/availability', '/me/theme']) {
    await page.route(`${API_BASE}${path}`, (route) => {
      writes.push({ path, body: route.request().postDataJSON() });
      if (path === '/me/theme') finished = true;
      return route.fulfill({ json: {} });
    });
  }
  await page.goto('/me/onboarding');
  await page.getByRole('textbox').fill('+5511987654321');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /^Big Tech/ }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Where should we reach you?' })).toBeFocused();
  await expect(page.getByRole('textbox')).toHaveValue('+55 (11) 98765-4321');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Big Tech/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'How much time per day?' })).toBeFocused();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dark or light?' })).toBeFocused();
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: "LET'S GOOOO" }).click();
  await expect(page).toHaveURL(/\/me$/);
  expect(writes.map((write) => write.path)).toEqual(['/me/profile', '/me/availability', '/me/theme']);
  expect(writes[0].body).toEqual({ whatsappPhone: '+5511987654321', targetTrack: 'BIG_TECH' });
  expect(writes[1].body).toMatchObject({ mondayMinutes: 60, tuesdayMinutes: 60, wednesdayMinutes: 60, thursdayMinutes: 60, fridayMinutes: 30, saturdayMinutes: 90, sundayMinutes: 0, preferredSessionMinutes: 30 });
  expect(writes[1].body.timezone).toBe(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone));
  expect(writes[2].body).toEqual({ themePreference: 'LIGHT' });
});


test('onboarding cannot finish before the final question enters', async ({ page }) => {
  await mockStudioMember(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route(new RegExp(`^${API_BASE}/me$`), (route) => route.fulfill({ json: { ...member, targetTrack: null } }));
  await page.goto('/me/onboarding');
  await page.getByRole('textbox').fill('+5511987654321');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /^Big Tech/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'How much time per day?' })).toBeFocused();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('button', { name: "LET'S GOOOO" })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Dark or light?' })).toBeFocused();
  await expect(page.getByRole('button', { name: "LET'S GOOOO" })).toBeEnabled();
});
