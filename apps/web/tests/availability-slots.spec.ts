/**
 * Playwright smoke test — availability slot editor at /me/settings
 *
 * Auth pattern (no globalSetup / storageState):
 *   The app reads its JWT from localStorage key `ics_access_token` (see
 *   apps/web/lib/api/client.ts: getAccessToken / setAccessToken).
 *   We inject a fake token via page.addInitScript() before every navigation
 *   so the AuthProvider hydrates immediately.
 *
 *   All API calls are intercepted with page.route() so no live backend is
 *   needed. We mock:
 *     GET /me              → valid MEMBER user (targetTrack non-null, googleConnected: true)
 *     GET /me/availability → empty slots (clean slate for the test)
 *     PATCH /me/availability → 204 success
 *
 * Scope: preset application + overlap detection guard (Save disabled).
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
  preferredSessionMinutes: 30,
  timezone: 'America/Sao_Paulo',
  slots: [],
};

test.describe('availability slot editor', () => {
  test.beforeEach(async ({ page }) => {
    // Inject fake JWT into localStorage before any page script runs.
    await page.addInitScript(() => {
      window.localStorage.setItem('ics_access_token', 'fake-test-token');
    });

    // Mock GET /me — returns a valid MEMBER so OnboardingGate does not redirect.
    // Use a regex with $ anchor so it does NOT match /me/availability.
    await page.route(new RegExp(`^${API_BASE}/me$`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER),
      });
    });

    // Mock /me/availability — handles both GET (return slots) and PATCH (204 success).
    await page.route(`${API_BASE}/me/availability`, (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_AVAILABILITY),
        });
      } else if (method === 'PATCH') {
        route.fulfill({ status: 204 });
      } else {
        route.continue();
      }
    });
  });

  test('preset + overlap guard', async ({ page }) => {
    await page.goto('/me/settings');

    // The Availability section heading must be visible.
    await expect(page.getByText('Available time slots')).toBeVisible();

    // Apply the "Noite de semana" preset — sets Mon-Fri 19:00-22:00.
    await page.getByRole('button', { name: 'Noite de semana' }).click();

    // Monday's start selector (aria-label "Mon start") should now show 19:00.
    const mondayStart = page.getByRole('combobox', { name: 'Mon start' }).first();
    await expect(mondayStart).toHaveValue('19:00');

    // Add a second slot for Monday by clicking "adicionar faixa" in the Mon row.
    // Locate the Mon row as the nearest ancestor of the "Mon start" combobox that
    // also contains the "adicionar faixa" button.
    const monRow = page
      .getByRole('combobox', { name: 'Mon start' })
      .first()
      .locator('xpath=ancestor::div[.//button[normalize-space()="adicionar faixa"]][1]');
    await monRow.getByRole('button', { name: 'adicionar faixa' }).click();

    // Change the newly added slot to 08:00–20:00 (overlaps the preset 19:00-22:00).
    const allMonStarts = page.getByRole('combobox', { name: 'Mon start' });
    const allMonEnds = page.getByRole('combobox', { name: 'Mon end' });
    await allMonStarts.last().selectOption('08:00');
    await allMonEnds.last().selectOption('20:00');

    // The overlap warning must appear in the Mon row.
    await expect(page.getByText(/faixas se sobrepõem/i)).toBeVisible();

    // The Save button must be disabled while any overlap exists.
    await expect(
      page.getByRole('button', { name: /Save availability/i }),
    ).toBeDisabled();
  });
});
