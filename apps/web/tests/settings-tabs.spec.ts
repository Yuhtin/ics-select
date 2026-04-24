/**
 * Playwright smoke tests — settings tabs layout at /me/settings
 *
 * Auth pattern: identical to availability-slots.spec.ts.
 *   localStorage `ics_access_token` injected via addInitScript, all API
 *   calls mocked via page.route() — no live backend needed.
 *
 * Mocked routes:
 *   GET /me              → valid MEMBER user
 *   GET /me/availability → one Monday slot (Mon 19:00-22:00)
 *   PATCH /me/availability → 200 echo (same shape, no state changes)
 *   PATCH /me/profile    → 200 echo
 *   PATCH /me/theme      → 200 {}
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3001';

const MOCK_USER = {
  id: 'test-user-1',
  email: 'member@test.com',
  name: 'Test Member',
  pictureUrl: null,
  role: 'MEMBER',
  privacyAcceptedAt: '2025-01-01T00:00:00.000Z',
  whatsappPhone: null,
  targetTrack: 'BIG_TECH',
  googleConnected: true,
};

const MOCK_AVAILABILITY = {
  mondayMinutes: null,
  tuesdayMinutes: null,
  wednesdayMinutes: null,
  thursdayMinutes: null,
  fridayMinutes: null,
  saturdayMinutes: null,
  sundayMinutes: null,
  preferredSessionMinutes: 60,
  timezone: 'America/Sao_Paulo',
  slots: [
    { id: 's1', dayOfWeek: 0, startMinute: 1140, endMinute: 1320 }, // Mon 19:00-22:00
  ],
};

test.describe('settings tabs', () => {
  test.beforeEach(async ({ page }) => {
    // Inject fake JWT into localStorage before any page script runs.
    await page.addInitScript(() => {
      window.localStorage.setItem('ics_access_token', 'fake-test-token');
    });

    // GET /me — returns a valid MEMBER so OnboardingGate does not redirect.
    // Anchored with $ so it does NOT match /me/availability or /me/profile.
    await page.route(new RegExp(`^${API_BASE}/me$`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER),
      });
    });

    // /me/availability — handles GET (return slots) and PATCH (200 echo).
    await page.route(`${API_BASE}/me/availability`, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_AVAILABILITY),
        });
      } else if (method === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_AVAILABILITY),
        });
      } else {
        route.continue();
      }
    });

    // /me/theme — appearance page mutations.
    await page.route(`${API_BASE}/me/theme`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    // /me/profile — profile page mutations.
    await page.route(`${API_BASE}/me/profile`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER),
      }),
    );
  });

  test('/me/settings redirects to /me/settings/profile and shows WhatsApp phone section', async ({
    page,
  }) => {
    await page.goto('/me/settings');
    await expect(page).toHaveURL(/\/me\/settings\/profile$/);
    await expect(page.getByText('WhatsApp phone')).toBeVisible();
  });

  test('navigating to Availability renders the grid and indicator shows Saved', async ({
    page,
  }) => {
    await page.goto('/me/settings');
    // Both desktop sidebar and mobile pills render — use .first() to grab one.
    await page.getByRole('link', { name: 'Availability' }).first().click();
    await expect(page).toHaveURL(/\/me\/settings\/availability$/);
    await expect(page.getByText('Available time slots')).toBeVisible();
    // GlobalSaveIndicator is idle on load → shows "Saved".
    await expect(page.getByRole('status')).toContainText(/Saved/i);
  });

  test('overlap on availability page surfaces in the global indicator', async ({ page }) => {
    await page.goto('/me/settings/availability');
    await expect(page.getByText('Available time slots')).toBeVisible();

    // The fixture already has Mon 19:00-22:00. Add a second overlapping slot.
    // Locate the Mon row as the nearest ancestor of the first "Mon start"
    // combobox that also contains the "adicionar faixa" button — the same
    // locator approach proven in availability-slots.spec.ts.
    const monRow = page
      .getByRole('combobox', { name: 'Mon start' })
      .first()
      .locator('xpath=ancestor::div[.//button[normalize-space()="adicionar faixa"]][1]');
    await monRow.getByRole('button', { name: 'adicionar faixa' }).click();

    // Set the new slot to 08:00-20:00, which overlaps 19:00-22:00.
    await page.getByRole('combobox', { name: 'Mon start' }).last().selectOption('08:00');
    await page.getByRole('combobox', { name: 'Mon end' }).last().selectOption('20:00');

    // Inline overlap warning inside the row.
    await expect(page.getByText(/faixas se sobrepõem/i)).toBeVisible();
    // GlobalSaveIndicator switches to overlap state.
    await expect(page.getByText(/Fix overlap to save/i)).toBeVisible();
  });
});
