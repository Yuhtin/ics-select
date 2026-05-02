/**
 * Playwright smoke test — /me/retro renders recap, allows submit with item links.
 *
 * Mocked routes:
 *   GET /me                 → valid MEMBER user
 *   GET /me/retro/current   → open=true, no existing retro, weekRecap with 3 items
 *   POST /me/retro          → 200 echo
 */

import { test, expect } from '@playwright/test';

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
  // Use .first() because HeroUI Select also renders hidden <option> elements with the same text.
  await expect(page.getByText('SQL Joins Explained').first()).toBeVisible();
  await expect(page.getByText('Indexes Deep Dive').first()).toBeVisible();
  await expect(page.getByText('Query Plan Explained').first()).toBeVisible();
});

test('Q1 (stuck) renders only because there is one DOUBTS item; Q2 (valued) renders because plan exists', async ({ page }) => {
  await page.goto('/me/retro');
  // Q1: only shows when there are DOUBTS/STUCK items (we have 1 DOUBTS item).
  await expect(page.getByText('Qual item dessa semana travou ou ficou com dúvida?')).toBeVisible();
  // Q2: always shows when weekRecap is non-null.
  await expect(page.getByText('Qual item dessa semana mais valeu a pena?')).toBeVisible();
  // Q3: always visible.
  await expect(page.getByText('1 coisa que você quer no próximo plano')).toBeVisible();
});

test('submit posts the linked ids', async ({ page }) => {
  let captured: any = null;
  await page.route(`${API_BASE}/me/retro`, async (r) => {
    if (r.request().method() === 'POST') {
      captured = JSON.parse(r.request().postData() ?? '{}');
      await r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    } else {
      await r.continue();
    }
  });
  await page.goto('/me/retro');
  // The wish textarea has a distinctive placeholder starting with "ex: 'menos LeetCode".
  await page.getByPlaceholder(/menos LeetCode/).fill('mais SD');
  await page.getByRole('button', { name: /submit retro/i }).click();
  // Captured POST body contains the nextWeekWish field.
  await expect.poll(() => captured).not.toBeNull();
  expect(captured.nextWeekWish).toBe('mais SD');
});
