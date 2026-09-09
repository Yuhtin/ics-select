/**
 * Guided Retro: presentation, accessibility, and the existing mutation contract.
 *
 * Mocked routes:
 *   GET /me                 → valid MEMBER user
 *   GET /me/retro/current   → open=true, no existing retro, weekRecap with 3 items
 *   POST /me/retro          → 200 echo
 */

import { test, expect, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:3001';

const MOCK_USER = {
  id: 'u-1',
  email: 'eduardo@test.com',
  name: 'Eduardo',
  pictureUrl: null,
  role: 'MEMBER',
  privacyAcceptedAt: '2026-01-01T00:00:00.000Z',
  whatsappPhone: null,
  targetTrack: 'BIG_TECH',
  googleConnected: true,
};

const MOCK_RETRO_CURRENT = {
  open: true,
  retro: null,
  windowOpensAt: '2026-04-17T21:00:00.000Z',
  windowClosesAt: '2026-04-19T23:59:59.999Z',
  weekRecap: {
    stats: { nailed: 1, hard: 1, doubts: 1, stuck: 0, skipped: 0, minutesStudied: 75 },
    items: [
      { id: 'wpi-1', title: 'SQL Joins Explained',  format: 'VIDEO',   estimatedMinutes: 30, url: null, outcome: 'DONE_EASY', order: 0 },
      { id: 'wpi-2', title: 'Indexes Deep Dive',     format: 'VIDEO',   estimatedMinutes: 45, url: null, outcome: 'DONE_HARD', order: 1 },
      { id: 'wpi-3', title: 'Query Plan Explained',  format: 'ARTICLE', estimatedMinutes: 20, url: null, outcome: 'DOUBTS',    order: 2 },
    ],
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('ics_access_token', 'fake-token');
  });

  // Anchored so /me/retro/current does NOT match this route.
  await page.route(new RegExp(`^${API_BASE}/me$`), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) }),
  );

  await page.route(`${API_BASE}/me/retro/current`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_RETRO_CURRENT) }),
  );
});

test('renders recap stats + items list', async ({ page }) => {
  await page.goto('/me/retro');
  // RetroRecap renders stats as "{value} {label}" via the Stat component.
  await expect(page.getByText('1 nailed')).toBeVisible();
  await expect(page.getByText('1 hard')).toBeVisible();
  await expect(page.getByText('1 doubts')).toBeVisible();
  // Item titles are rendered in RecapRow paragraph elements inside an <ul>.
  // The active choice may repeat a recap title; the first match is the recap.
  await expect(page.getByText('SQL Joins Explained').first()).toBeVisible();
  await expect(page.getByText('Indexes Deep Dive').first()).toBeVisible();
  await expect(page.getByText('Query Plan Explained').first()).toBeVisible();
});

const STUCK = 'Qual item dessa semana travou ou ficou com dúvida?';
const UNBLOCK = 'O que falta pra desbloquear?';
const VALUED = 'Qual item dessa semana mais valeu a pena?';
const WISH = '1 coisa que você quer no próximo plano';

async function next(page: Page) {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}
async function reachFinal(page: Page) {
  for (let index = 0; index < 4; index++) {
    await expect(page.getByText(`${index + 1} of 5`, { exact: true })).toBeVisible();
    await next(page);
  }
  await expect(page.getByRole('heading', { name: WISH })).toBeVisible();
}

test('Retro presents one conditional question at a time and preserves answers', async ({ page }) => {
  await page.goto('/me/retro');
  await expect(page.getByRole('heading', { name: STUCK })).toBeFocused();
  await expect(page.getByText('1 of 5', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: VALUED })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exit reflection' })).toBeVisible();
  await page.keyboard.press('A');
  await expect(page.getByRole('radio', { name: 'Query Plan Explained' })).toBeChecked();
  await next(page);
  await expect(page.getByRole('heading', { name: UNBLOCK })).toBeFocused();
  await page.keyboard.press('Tab');
  const answer = page.getByRole('textbox', { name: UNBLOCK });
  await expect(answer).toBeFocused();
  await answer.fill('Rever o invariante com um exemplo menor.');
  await page.keyboard.type('abc');
  await expect(answer).toHaveValue('Rever o invariante com um exemplo menor.abc');
  await next(page);
  await expect(page.getByRole('heading', { name: VALUED })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Nenhum' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: 'SQL Joins Explained' })).toBeChecked();
  await page.getByRole('button', { name: 'Previous question' }).click();
  await expect(answer).toHaveValue('Rever o invariante com um exemplo menor.abc');
});

test('Retro submits the existing payload only on the final step', async ({ page }) => {
  const posts: unknown[] = [];
  await page.route(`${API_BASE}/me/retro`, async (route) => {
    posts.push(route.request().postDataJSON());
    await route.fulfill({ json: {} });
  });
  await page.goto('/me/retro');
  await page.getByRole('radio', { name: 'Query Plan Explained' }).check();
  await next(page);
  await page.getByRole('textbox', { name: UNBLOCK }).fill('  Rever o invariante.  ');
  await next(page);
  await page.getByRole('radio', { name: 'SQL Joins Explained' }).check();
  await next(page);
  await page.getByRole('textbox', { name: 'Por quê?' }).fill('O exemplo conectou teoria e prática.');
  await next(page);
  await page.getByRole('textbox', { name: WISH }).fill('mais system design');
  expect(posts).toEqual([]);
  await page.getByRole('button', { name: 'Submit retro' }).click();
  await expect(page.getByText('Retro saved', { exact: true })).toBeVisible();
  expect(posts).toEqual([{
    whatClicked: 'O exemplo conectou teoria e prática.', whatStuck: 'Rever o invariante.',
    nextWeekWish: 'mais system design', valuedItemId: 'wpi-1', stuckItemId: 'wpi-3',
  }]);
});

test('Retro keeps the final answer visible after a failed submit', async ({ page }) => {
  await page.route(`${API_BASE}/me/retro`, (route) => route.fulfill({ status: 500, json: { message: 'Unavailable' } }));
  await page.goto('/me/retro');
  await reachFinal(page);
  const wish = page.getByRole('textbox', { name: WISH });
  await wish.fill('uma semana mais leve');
  await page.getByRole('button', { name: 'Submit retro' }).click();
  await expect(page.getByText('Could not save retro')).toBeVisible();
  await expect(wish).toHaveValue('uma semana mais leve');
});

const SUBMITTED = {
  id: 'retro-1', whatClicked: 'Conectou teoria e prática.', whatStuck: 'Um exemplo menor.',
  nextWeekWish: 'mais system design', valuedItemId: 'wpi-1', stuckItemId: 'wpi-3',
  submittedAt: '2026-04-18T12:00:00.000Z',
};

test('submitted Retro prefills every answer and offers Update retro', async ({ page }) => {
  await page.route(`${API_BASE}/me/retro/current`, (route) => route.fulfill({ json: { ...MOCK_RETRO_CURRENT, retro: SUBMITTED } }));
  await page.goto('/me/retro');
  await expect(page.getByRole('radio', { name: 'Query Plan Explained' })).toBeChecked();
  await next(page);
  await expect(page.getByRole('textbox', { name: UNBLOCK })).toHaveValue(SUBMITTED.whatStuck);
  await next(page);
  await expect(page.getByRole('radio', { name: 'SQL Joins Explained' })).toBeChecked();
  await next(page);
  await expect(page.getByRole('textbox', { name: 'Por quê?' })).toHaveValue(SUBMITTED.whatClicked);
  await next(page);
  await expect(page.getByRole('textbox', { name: WISH })).toHaveValue(SUBMITTED.nextWeekWish);
  await expect(page.getByRole('button', { name: 'Update retro' })).toBeEnabled();
});

test('recap without stuck items has three optional steps', async ({ page }) => {
  await page.route(`${API_BASE}/me/retro/current`, (route) => route.fulfill({ json: {
    ...MOCK_RETRO_CURRENT, weekRecap: { ...MOCK_RETRO_CURRENT.weekRecap, items: [] },
  } }));
  await page.goto('/me/retro');
  await expect(page.getByText('1 of 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: VALUED })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Nenhum' })).toBeChecked();
  await next(page);
  await expect(page.getByRole('textbox', { name: 'Por quê?' })).toBeVisible();
  await next(page);
  await expect(page.getByText('3 of 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit retro' })).toBeEnabled();
});

test('no recap has one optional step and pending submit prevents duplicate requests', async ({ page }) => {
  await page.route(`${API_BASE}/me/retro/current`, (route) => route.fulfill({ json: { ...MOCK_RETRO_CURRENT, weekRecap: null } }));
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let body: unknown;
  await page.route(`${API_BASE}/me/retro`, async (route) => {
    body = route.request().postDataJSON();
    await pending;
    await route.fulfill({ json: {} });
  });
  await page.goto('/me/retro');
  await expect(page.getByText('1 of 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Submit retro' }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(body).toEqual({ valuedItemId: null, stuckItemId: null });
  release();
  await expect(page.getByText('Retro saved', { exact: true })).toBeVisible();
});

for (const retro of [null, SUBMITTED]) {
  test(`closed Retro renders ${retro ? 'submitted answers' : 'notice'} without form controls`, async ({ page }) => {
    await page.route(`${API_BASE}/me/retro/current`, (route) => route.fulfill({ json: { ...MOCK_RETRO_CURRENT, open: false, retro } }));
    await page.goto('/me/retro');
    await expect(page.getByText('Retro closed', { exact: false })).toBeVisible();
    await expect(page.locator('textarea, input[type="radio"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /submit retro|update retro/i })).toHaveCount(0);
    if (retro) {
      await expect(page.getByText(retro.whatClicked, { exact: true })).toBeVisible();
      await expect(page.getByText(retro.whatStuck, { exact: true })).toBeVisible();
      await expect(page.getByText(retro.nextWeekWish, { exact: true })).toBeVisible();
    }
  });
}

test('closing the window reviews the saved submission, not an unsaved edit', async ({ page }) => {
  let open = true;
  await page.route(`${API_BASE}/me/retro/current`, (route) => route.fulfill({ json: { ...MOCK_RETRO_CURRENT, open, retro: SUBMITTED } }));
  await page.goto('/me/retro');
  await next(page);
  await page.getByRole('textbox', { name: UNBLOCK }).fill('An unsaved draft');
  open = false;
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('Retro closed', { exact: false })).toBeVisible();
  await expect(page.getByText(SUBMITTED.whatStuck, { exact: true })).toBeVisible();
  await expect(page.getByText('An unsaved draft', { exact: true })).toHaveCount(0);
});

test('Retro exposes load failure without flashing inputs', async ({ page }) => {
  await page.route(`${API_BASE}/me/retro/current`, (route) => route.fulfill({ status: 500, json: {} }));
  await page.goto('/me/retro');
  await expect(page.getByText('Could not load your retro.')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('textarea, input[type="radio"]')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`retro open and closed states stay readable in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
    await page.goto('/me/retro');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await expect(page.getByRole('heading', { name: STUCK })).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page).toHaveScreenshot(`academy-retro-open-${theme}-mobile.png`, { fullPage: true, animations: 'disabled' });
    await next(page);
    await expect(page.getByRole('heading', { name: UNBLOCK })).toBeFocused();
    const response = page.getByRole('textbox', { name: UNBLOCK });
    await response.fill('Rever o invariante com um exemplo menor.');
    const continueAction = page.getByRole('button', { name: 'Continue', exact: true });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    // The document can scroll beneath the fixed navigation, including with a focused input.
    const actionBox = await continueAction.boundingBox();
    const navBox = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
    expect(actionBox!.height).toBeGreaterThanOrEqual(44);
    expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(navBox!.y);
    await expect(page).toHaveScreenshot(`academy-retro-response-${theme}-mobile.png`, { fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page).toHaveScreenshot(`academy-retro-response-${theme}-desktop.png`, { fullPage: true, animations: 'disabled' });
    await expect(page.locator('[data-guided-panel]')).toHaveCSS('transform', 'none');
    await page.route(`${API_BASE}/me/retro/current`, (route) => route.fulfill({ json: { ...MOCK_RETRO_CURRENT, open: false } }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await expect(page.getByText('Retro closed', { exact: false })).toBeVisible();
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page).toHaveScreenshot(`academy-retro-closed-${theme}-mobile.png`, { fullPage: true, animations: 'disabled' });
  });
}
