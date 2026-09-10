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

    await page.route(`${API_BASE}/me/retro/current`, (route) => route.fulfill({ json: { open: false, retro: null } }));

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

  test('settings uses ruled local navigation and low-emphasis fields', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/me/settings/profile');
    const nav = page.getByRole('navigation', { name: 'Settings sections' });
    const active = nav.getByRole('link', { name: 'Profile', exact: true });
    await expect(active).toHaveAttribute('aria-current', 'page');
    await expect(nav).toHaveCSS('border-right-width', '1px');
    await expect.soft(active).toHaveCSS('border-left-width', '3px');
    await expect.soft(active).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    const phone = page.getByRole('textbox');
    await expect.soft(phone).toHaveCSS('border-bottom-width', '2px');
    await expect.soft(phone).toHaveCSS('border-top-width', '0px');
    await expect(page.getByRole('status')).toContainText('Saved');
  });

  test('mobile settings tabs use an active underline and never clip', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/me/settings/appearance');
    const active = page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Appearance' });
    await expect(active).toHaveCSS('border-bottom-width', '2px');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('availability query failure stays in the settings content column', async ({ page }) => {
    await page.route(`${API_BASE}/me/availability`, (route) => route.fulfill({ status: 503, json: {} }));
    await page.goto('/me/settings/availability');
    await expect(page.getByText('Could not load availability.', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Available time slots', { exact: true })).toHaveCount(0);
  });

  test('/me/settings redirects to /me/settings/profile and shows WhatsApp phone section', async ({
    page,
  }) => {
    await page.goto('/me/settings');
    await expect(page).toHaveURL(/\/me\/settings\/profile$/);
    await expect(page.getByText('Academy Fellow', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('ICS Select', { exact: true })).toHaveCount(0);
    await expect(page.getByText('WhatsApp phone').first()).toBeVisible();
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`mobile settings tab focus stays inside the scroller in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.goto('/me/settings/profile');
      const nav = page.getByRole('navigation', { name: 'Settings sections' });
      const before = await nav.boundingBox();
      for (const link of await nav.getByRole('link').all()) {
        await link.focus();
        await expect(link).toBeFocused();
        // An inset ring stays within the 44px link, including the scroller's bottom edge.
        await expect(link).toHaveCSS('box-shadow', /inset/);
        const geometry = await link.evaluate((element) => {
          const link = element.getBoundingClientRect();
          const nav = element.closest('nav')!.getBoundingClientRect();
          return { left: link.left - nav.left, right: nav.right - link.right,
            top: link.top - nav.top, bottom: nav.bottom - link.bottom, height: link.height };
        });
        expect(geometry.left).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeGreaterThanOrEqual(0);
        expect(geometry.top).toBeGreaterThanOrEqual(0);
        expect(geometry.bottom).toBeGreaterThanOrEqual(0);
        expect(geometry.height).toBeGreaterThanOrEqual(44);
      }
      expect((await nav.boundingBox())!.height).toBe(before!.height);
      await expect(nav.getByRole('link', { name: 'Profile', exact: true })).toHaveCSS('border-bottom-width', '2px');
      await expect(nav).toHaveCSS('overflow-x', 'auto');
    });

    test(`invalid phone has a distinct unclipped keyboard focus in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.goto('/me/settings/profile');
      const phone = page.getByRole('textbox', { name: 'WhatsApp phone' });
      await phone.fill('+55');
      await page.getByRole('heading', { name: 'Your preferences.' }).click();
      await expect(phone).toHaveAttribute('aria-invalid', 'true');
      const unfocused = await phone.evaluate((element) => {
        const style = getComputedStyle(element);
        return { shadow: style.boxShadow, border: style.borderBottomColor };
      });
      const lastTab = page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Availability' });
      await lastTab.focus();
      await page.keyboard.press('Tab');
      await expect(phone).toBeFocused();
      await expect(phone).not.toHaveCSS('box-shadow', unfocused.shadow);
      await expect(phone).toHaveCSS('box-shadow', /inset/);
      await expect(phone).toHaveCSS('border-bottom-color', unfocused.border);
      await expect(phone).toHaveCSS('border-top-width', '0px');
      await expect(phone).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const inside = await phone.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const parent = element.parentElement!.getBoundingClientRect();
        return rect.left >= parent.left && rect.right <= parent.right && rect.top >= parent.top && rect.bottom <= parent.bottom;
      });
      expect(inside).toBe(true);
      await expect(page.getByText('Formato inválido.', { exact: false })).toBeVisible();
    });

    test(`invalid timezone keeps distinct keyboard focus and its autosave contract in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      const patches: unknown[] = [];
      await page.route(`${API_BASE}/me/availability`, (route) => {
        if (route.request().method() === 'PATCH') patches.push(route.request().postDataJSON());
        return route.fulfill({ json: MOCK_AVAILABILITY });
      });
      await page.goto('/me/settings/availability');
      const timezone = page.getByRole('textbox', { name: 'Timezone' });
      await timezone.fill(' ');
      // Blur flushes the existing driver, which must reject an invalid timezone.
      await page.getByRole('heading', { name: 'Your preferences.' }).click();
      await expect(timezone).toHaveAttribute('aria-invalid', 'true');
      const unfocused = await timezone.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return { shadow: style.boxShadow, border: style.borderBottomColor, width: box.width, height: box.height };
      });
      await timezone.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(timezone).toBeFocused();
      await expect.soft(timezone).not.toHaveCSS('box-shadow', unfocused.shadow);
      await expect.soft(timezone).toHaveCSS('box-shadow', /0px -2px 0px 0px inset/);
      await expect(timezone).toHaveCSS('border-bottom-color', unfocused.border);
      await expect(timezone).toHaveAttribute('aria-invalid', 'true');
      for (const side of ['top', 'left', 'right']) await expect(timezone).toHaveCSS(`border-${side}-width`, '0px');
      await expect(timezone).toHaveCSS('border-bottom-width', '2px');
      await expect(timezone).toHaveCSS('border-radius', '0px');
      await expect(timezone).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const focused = await timezone.boundingBox();
      expect(focused!.width).toBe(unfocused.width);
      expect(focused!.height).toBe(unfocused.height);
      expect(focused!.height).toBeGreaterThanOrEqual(44);
      expect(patches).toEqual([]);
      await timezone.fill('Europe/Lisbon');
      await expect(timezone).not.toHaveAttribute('aria-invalid', 'true');
      // Keep focus: persistence must still occur through the existing debounce.
      await expect.poll(() => patches.length).toBeGreaterThan(0);
      // The existing development updater may be replayed by Strict Mode;
      // every actual write must retain the same complete availability payload.
      for (const patch of patches) expect(patch).toEqual({
        mondayMinutes: null, tuesdayMinutes: null, wednesdayMinutes: null, thursdayMinutes: null,
        fridayMinutes: null, saturdayMinutes: null, sundayMinutes: null,
        preferredSessionMinutes: 60, timezone: 'Europe/Lisbon', calendarBusy: true,
        slots: [{ dayOfWeek: 0, startMinute: 1140, endMinute: 1320 }], clearDays: [0, 1, 2, 3, 4, 5, 6],
      });
      await expect(timezone).toBeFocused();
      await expect(page.getByRole('status')).toContainText('Saved');
    });

    test(`settings fields preserve validation, autosave and retry feedback in ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      const patches: unknown[] = [];
      let releaseSave: (() => void) | undefined;
      await page.route(`${API_BASE}/me/profile`, async (route) => {
        patches.push(route.request().postDataJSON());
        if (patches.length === 1) {
          await new Promise<void>((resolve) => { releaseSave = resolve; });
          await route.fulfill({ status: 503, json: {} });
        } else {
          await route.fulfill({ json: MOCK_USER });
        }
      });
      await page.goto('/me/settings/profile');
      const phone = page.getByRole('textbox', { name: 'WhatsApp phone' });
      await phone.fill('+55');
      await expect(phone).toHaveAttribute('aria-invalid', 'true');
      const phoneError = page.getByText('Formato inválido.', { exact: false });
      await expect(phoneError).toBeVisible();
      await expect.soft(phone).toHaveAccessibleDescription('Formato inválido. Inclua o código do país (ex: +5511999999999).');
      const errorId = await phoneError.getAttribute('id');
      expect.soft(errorId).toBeTruthy();
      if (errorId) await expect(phone).toHaveAttribute('aria-describedby', errorId);
      await expect.soft(phoneError).toHaveAttribute('role', 'alert');
      await page.getByRole('heading', { name: 'Your preferences.' }).click();
      expect(patches).toEqual([]);
      await phone.fill('+5511987654321');
      await expect(phone).toHaveValue('+55 (11) 98765-4321');
      await expect(phone).not.toHaveAttribute('aria-invalid', 'true');
      await expect(phone).not.toHaveAttribute('aria-describedby');
      await expect(phoneError).toHaveCount(0);
      await expect(phone).toBeFocused();
      const focusColor = await phone.evaluate((element) => getComputedStyle(element).borderBottomColor);
      await expect(page.getByRole('status')).toContainText('Saving');
      expect(patches).toEqual([{ whatsappPhone: '+5511987654321' }]);
      releaseSave!();
      const retry = page.getByRole('button', { name: 'Save failed — Retry' });
      await expect(retry).toBeVisible();
      await retry.click();
      await expect(page.getByRole('status')).toContainText('Saved');
      expect(patches).toEqual([{ whatsappPhone: '+5511987654321' }, { whatsappPhone: '+5511987654321' }]);
      await expect(phone).toHaveValue('+55 (11) 98765-4321');
      await expect(phone).not.toHaveCSS('border-bottom-color', focusColor);

      let availabilityPatch: Record<string, unknown> | undefined;
      await page.route(`${API_BASE}/me/availability`, (route) => {
        if (route.request().method() === 'PATCH') availabilityPatch = route.request().postDataJSON();
        return route.fulfill({ json: MOCK_AVAILABILITY });
      });
      await page.goto('/me/settings/availability');
      const timezone = page.getByRole('textbox', { name: 'Timezone' });
      await expect(timezone).toHaveCSS('border-top-width', '0px');
      await expect(timezone).toHaveCSS('border-bottom-width', '2px');
      await timezone.fill('Europe/Lisbon');
      await page.getByRole('heading', { name: 'Your preferences.' }).click();
      await expect.poll(() => availabilityPatch?.timezone).toBe('Europe/Lisbon');
      expect(availabilityPatch?.slots).toEqual([{ dayOfWeek: 0, startMinute: 1140, endMinute: 1320 }]);
    });

    test(`all settings tabs fit desktop in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      for (const [tab, label] of [['profile', 'WhatsApp phone'], ['appearance', 'Your choice syncs across devices.'], ['availability', 'Available time slots']]) {
        await page.goto(`/me/settings/${tab}`);
        await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
        await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page).toHaveScreenshot(`academy-settings-${tab}-${theme}-desktop.png`, { fullPage: true, animations: 'disabled' });
      }
    });

    test(`time picker is immediately static with reduced motion in ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
      await page.goto('/me/settings/availability');
      const trigger = page.getByRole('button', { name: 'Mon end', exact: true });
      await expect(trigger).toBeVisible();
      const samples = await trigger.evaluate(async (element) => {
        const frames: Array<{ transform: string; opacity: string }> = [];
        const sample = () => {
          const panel = document.querySelector('[role="dialog"][aria-label="Mon end picker"]');
          if (panel) {
            const style = getComputedStyle(panel);
            frames.push({ transform: style.transform, opacity: style.opacity });
          }
        };
        // Observe insertion itself, then every animation frame. A retrying CSS
        // assertion would miss the first 160ms of an unwanted Motion transform.
        const observer = new MutationObserver(sample);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
        (element as HTMLButtonElement).click();
        await new Promise<void>((resolve) => {
          const start = performance.now();
          const tick = () => {
            sample();
            if (performance.now() - start < 250) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        observer.disconnect();
        return frames;
      });
      expect(samples.length).toBeGreaterThan(0);
      expect(samples.filter(({ transform, opacity }) => transform !== 'none' || opacity !== '1')).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
    });

    for (const zoom of [1, 2]) {
      test(`time picker fits a centered trigger in a short viewport at ${zoom}x zoom in ${theme}`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
        await page.setViewportSize({ width: 390, height: 600 });
        await page.goto('/me/settings/availability');
        const trigger = page.getByRole('button', { name: 'Mon end', exact: true });
        await expect(trigger).toBeVisible();
        if (zoom > 1) {
          const session = await page.context().newCDPSession(page);
          await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: zoom });
        }
        await trigger.evaluate((element) => {
          element.scrollIntoView({ block: 'center', inline: 'center' });
          // Keep the trigger centered in the visible area even at pinch zoom.
          const rect = element.getBoundingClientRect();
          window.scrollBy(0, rect.top + rect.height / 2 - window.visualViewport!.height / 2);
        });
        await trigger.focus();
        await page.keyboard.press('Enter');
        const panel = page.getByRole('dialog', { name: 'Mon end picker' });
        await expect(panel).toBeVisible();
        await expect(panel).toHaveCSS('opacity', '1');
        const bounds = await panel.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const viewport = window.visualViewport!;
          return { left: rect.left - viewport.offsetLeft, top: rect.top - viewport.offsetTop,
            right: rect.right - viewport.offsetLeft, bottom: rect.bottom - viewport.offsetTop,
            width: viewport.width, height: viewport.height, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight };
        });
        expect.soft(bounds.left).toBeGreaterThanOrEqual(0);
        expect.soft(bounds.top).toBeGreaterThanOrEqual(0);
        expect.soft(bounds.right).toBeLessThanOrEqual(bounds.width);
        expect.soft(bounds.bottom).toBeLessThanOrEqual(bounds.height);
        expect.soft(bounds.scrollHeight).toBeGreaterThan(bounds.clientHeight);
        expect(await panel.evaluate((element) => element.parentElement === document.body)).toBe(true);
        for (const choice of await panel.locator('button:enabled').all()) {
          await choice.evaluate((element) => element.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
          const reachable = await choice.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const panel = element.closest('[role="dialog"]')!.getBoundingClientRect();
            const viewport = window.visualViewport!;
            return rect.top >= Math.max(panel.top, viewport.offsetTop) && rect.bottom <= Math.min(panel.bottom, viewport.offsetTop + viewport.height)
              && rect.left >= Math.max(panel.left, viewport.offsetLeft) && rect.right <= Math.min(panel.right, viewport.offsetLeft + viewport.width);
          });
          expect.soft(reachable, await choice.getAttribute('aria-label') ?? 'End of day').toBe(true);
        }
        const choose = async (name: string | RegExp) => {
          const choice = panel.getByRole('button', { name, exact: true });
          if (zoom > 1) {
            // Chromium's emulated pinch zoom does not remap Playwright mouse
            // coordinates. Exercise native focus/Enter after measured scrolling.
            await choice.focus();
            await page.keyboard.press('Enter');
          } else {
            await choice.click();
          }
        };
        await choose('Hour 23');
        await choose('Minute 30');
        await expect(trigger).toHaveText('23:30');
        await expect(panel).toBeHidden();
        await trigger.focus();
        await page.keyboard.press('Enter');
        await choose(/End of day/);
        await expect(trigger).toHaveText('24:00');
        await trigger.focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('Escape');
        await expect(panel).toBeHidden();
        await expect(trigger).toBeFocused();
      });
    }

    for (const width of [390, 768, 1440]) {
      test(`all settings tabs fit Studio reference at ${width}px in ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
        for (const [tab, label] of [['profile', 'WhatsApp phone'], ['appearance', 'Your choice syncs across devices.'], ['availability', 'Available time slots']]) {
          await page.goto(`/me/settings/${tab}`);
          await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
          await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await expect(page).toHaveScreenshot(`academy-settings-${tab}-${theme}-${width === 390 ? 'mobile' : width}.png`, { fullPage: true, animations: 'disabled' });
        }
        if (width !== 390) return;
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
    }

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
    const rail = page.getByTestId('member-rail');
    await expect(rail).toBeVisible();
    const brandLink = rail.getByRole('link', { name: 'Academy Fellow home', exact: true });
    expect((await brandLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    const desktopNavigation = rail.getByRole('navigation', { name: 'Main navigation' });
    for (const [name, href] of [['Today', '/me'], ['Calendar', '/me/calendar'], ['Cohort', '/me/cohort'], ['Settings', '/me/settings']]) {
      await expect(desktopNavigation.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
    const theme = rail.getByRole('button', { name: /Switch to .* theme/ });
    await theme.focus();
    await expect(theme).toBeFocused();
    await expect(theme).not.toHaveCSS('box-shadow', 'none');
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ics-theme'))).toBe('dark');
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(rail.getByRole('button', { name: 'Sign out' })).toBeVisible();

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

  for (const width of [1280, 390]) {
    test(`dark member active navigation meets AA contrast at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(() => localStorage.setItem('ics-theme', 'dark'));
      await page.route(`${API_BASE}/me/retro/current`, (route) => route.fulfill({
        json: { open: true, retro: null },
      }));
      await page.goto('/me');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      const active = page.getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Today', exact: true });
      await expect(active).toHaveAttribute('aria-current', 'page');
      const controls = width >= 768
        ? [page.getByRole('link', { name: 'Retro open' }), active]
        : [active];
      for (const control of controls) {
        await expect(control).toBeVisible();
        const contrast = await control.evaluate((element) => {
          const luminance = (color: string) => {
            const [r, g, b] = color.match(/[\d.]+/g)!.slice(0, 3).map((value) => {
              const channel = Number(value) / 255;
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const style = getComputedStyle(element);
          const text = luminance(style.color);
          const background = luminance(style.backgroundColor);
          return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
        });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

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
