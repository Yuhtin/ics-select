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
    await expect(page.getByText('Academy Fellow', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('ICS Select', { exact: true })).toHaveCount(0);
    await expect(page.getByText('WhatsApp phone')).toBeVisible();
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`all settings tabs fit mobile in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      for (const [tab, label] of [['profile', 'WhatsApp phone'], ['appearance', 'Your choice syncs across devices.'], ['availability', 'Available time slots']]) {
        await page.goto(`/me/settings/${tab}`);
        await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
        await expect(page.getByText(label, { exact: true })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page).toHaveScreenshot(`academy-settings-${tab}-${theme}-mobile.png`, { fullPage: true, animations: 'disabled' });
      }
      await page.keyboard.press('Tab');
      await page.getByRole('button', { name: 'What does this do?' }).focus();
      await expect(page.getByRole('tooltip')).toContainText('study events created by Academy Fellow');
      for (const label of ['Mon start', 'Mon end']) {
        await page.getByRole('button', { name: label, exact: true }).click();
        const dialog = page.getByRole('dialog', { name: `${label} picker` });
        await expect(dialog).toHaveCSS('opacity', '1');
        await expect(dialog).toHaveCSS('transform', 'none');
        const choices = await dialog.locator('button:enabled').evaluateAll((buttons) => buttons.map((button) => {
          const { width, height } = button.getBoundingClientRect();
          return { label: button.getAttribute('aria-label') ?? button.textContent, width, height };
        }));
        expect(choices.length).toBeGreaterThan(0);
        expect.soft(choices.find(({ width, height }) => width < 44 || height < 44), `${label} choices must be at least 44×44px`).toBeUndefined();
        if (label === 'Mon end') {
          expect.soft((await dialog.getByRole('button', { name: /End of day/ }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
        }
        const bounds = await dialog.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
        if (label === 'Mon start') {
          await expect(dialog).toHaveScreenshot(`academy-time-picker-${theme}.png`, { animations: 'disabled' });
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
      }
    });

    test(`onboarding steps stay readable in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.route(new RegExp(`^${API_BASE}/me$`), (route) => route.fulfill({ json: { ...MOCK_USER, targetTrack: null } }));
      await page.goto('/me/onboarding');
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      await expect(page.getByRole('heading', { name: 'Where should we reach you?' })).toBeVisible();
      await page.getByRole('textbox').fill('+55');
      await expect(page.getByText('E.164 format:', { exact: false })).toBeVisible();
      const sansFont = await page.locator('body').evaluate((body) => getComputedStyle(body).fontFamily);
      await expect.soft(page.getByText('E.164 format:', { exact: false })).toHaveCSS('font-family', sansFont);
      await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
      await page.getByRole('textbox').fill('+5511987654321');
      await page.getByRole('button', { name: 'Next' }).click();
      await page.getByRole('button', { name: /^Big Tech/ }).click();
      await expect(page).toHaveScreenshot(`academy-onboarding-track-${theme}.png`, { fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'How much time per day?' })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Dark or light?' })).toBeVisible();
      await expect(page.getByRole('button', { name: "LET'S GOOOO" })).toBeEnabled();
      await page.route(`${API_BASE}/me/profile`, (route) => route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE', message: "Couldn't save. Try again." } },
      }));
      await page.getByRole('button', { name: "LET'S GOOOO" }).click();
      const submitError = page.getByText("Couldn't save. Try again.", { exact: true });
      await expect(submitError).toBeVisible();
      await expect.soft(submitError).toHaveCSS('font-family', sansFont);
      await expect(page.getByRole('button', { name: "LET'S GOOOO" })).toBeEnabled();
    });
  }

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
    // Locate the Mon row as the nearest ancestor of the first "Mon start" pill
    // that also contains the "adicionar faixa" button — the same locator
    // approach proven in availability-slots.spec.ts.
    const monRow = page
      .getByRole('button', { name: 'Mon start' })
      .first()
      .locator('xpath=ancestor::div[.//button[normalize-space()="adicionar faixa"]][1]');
    await monRow.getByRole('button', { name: 'adicionar faixa' }).click();

    // Set the new slot to 08:00-20:00, which overlaps 19:00-22:00.
    // The TimePill opens a popover with Hour/Minute buttons (aria-labelled).
    await page.getByRole('button', { name: 'Mon start' }).last().click();
    await page.getByRole('button', { name: 'Hour 08' }).click();
    await page.getByRole('button', { name: 'Minute 00' }).click();

    await page.getByRole('button', { name: 'Mon end' }).last().click();
    const endPicker = page.getByRole('dialog', { name: 'Mon end picker' });
    await endPicker.getByRole('button', { name: 'Hour 20' }).click();
    await endPicker.getByRole('button', { name: 'Minute 00' }).click();

    // Inline overlap warning inside the row.
    await expect(page.getByText(/faixas se sobrepõem/i)).toBeVisible();
    // GlobalSaveIndicator switches to overlap state.
    await expect(page.getByText(/Fix overlap to save/i)).toBeVisible();
  });

  test('member shell preserves desktop and mobile destinations, theme and focus', async ({ page }) => {
    await page.goto('/me/settings/profile');
    const header = page.locator('header');
    await expect(header.getByText('Academy Fellow', { exact: true })).toBeVisible();
    const brandLink = header.getByRole('link', { name: 'Academy Fellow', exact: true });
    expect((await brandLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    for (const [name, href] of [['Today', '/me'], ['Calendar', '/me/calendar'], ['Cohort', '/me/cohort'], ['Settings', '/me/settings']]) {
      await expect(header.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
    const theme = header.getByRole('button', { name: /Switch to .* theme/ });
    await theme.focus();
    await expect(theme).toBeFocused();
    await expect(theme).not.toHaveCSS('box-shadow', 'none');
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ics-theme'))).toBe('dark');
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(header.getByRole('button', { name: 'Sign out' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(navigation.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    for (const [name, href] of [['Today', '/me'], ['Calendar', '/me/calendar'], ['Cohort', '/me/cohort'], ['Profile', '/me/settings']]) {
      const link = navigation.getByRole('link', { name: new RegExp(`${name}$`) });
      await expect(link).toHaveAttribute('href', href);
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    await navigation.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/me\/settings\/profile$/);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('reconnect gate uses Academy Fellow and preserves the OAuth destination', async ({ page }) => {
    await page.route(new RegExp(`^${API_BASE}/me$`), (route) => route.fulfill({
      json: { ...MOCK_USER, googleConnected: false },
    }));
    await page.goto('/me/settings/profile');
    await expect(page.getByRole('heading', { name: 'Reconnect your Google Calendar' })).toBeVisible();
    await expect(page.getByText(/We updated how Academy Fellow/)).toBeVisible();
    const reconnect = page.getByRole('link', { name: 'Reconnect Google' });
    await expect(reconnect).toHaveAttribute('href', '/auth/google');
    await reconnect.focus();
    await expect(reconnect).not.toHaveCSS('box-shadow', 'none');
    await expect(page.getByText('WhatsApp phone')).toHaveCount(0);
  });

  test('onboarding still takes precedence over the reconnect gate', async ({ page }) => {
    await page.route(new RegExp(`^${API_BASE}/me$`), (route) => route.fulfill({
      json: { ...MOCK_USER, targetTrack: null, googleConnected: false },
    }));
    await page.goto('/me/settings/profile');
    await expect(page).toHaveURL(/\/me\/onboarding$/);
    await expect(page.getByRole('link', { name: 'Reconnect Google' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  });
});
