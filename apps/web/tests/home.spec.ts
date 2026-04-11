import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('shows the project name and tagline', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ICS Select' })).toBeVisible();
    await expect(
      page.getByText('Programa de Preparação Avançada para Entrevistas Técnicas'),
    ).toBeVisible();
  });

  test('visual snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('home.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
