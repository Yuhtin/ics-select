import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('login page shows Google button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible();
  });

  test('unauthenticated root redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('simulated logged-in admin sees cycles nav', async ({ page }) => {
    // Seed localStorage with a fake access token; the app will call /me with it.
    // We intercept /me to return an admin user that has accepted privacy.
    await page.route('**/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-1',
          email: 'admin@sou.inteli.edu.br',
          name: 'Admin Teste',
          pictureUrl: null,
          role: 'ADMIN',
          privacyAcceptedAt: new Date().toISOString(),
        }),
      });
    });
    await page.route('**/cycles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('ics_access_token', 'fake.jwt.token');
    });

    await page.goto('/');

    // Wait for the authenticated shell to render (main content heading is visible
    // on both desktop and mobile).
    await expect(page.getByRole('heading', { name: 'Ciclos' })).toBeVisible();

    // On mobile the sidebar lives inside a drawer — open it if the menu button is visible.
    const menuButton = page.getByRole('button', { name: 'Abrir menu' });
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }

    await expect(page.getByRole('link', { name: 'Ciclos' })).toBeVisible();
  });
});
