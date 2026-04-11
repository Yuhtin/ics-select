import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('shows the project name and tagline', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'ICS Select' })).toBeVisible();
    await expect(
      page.getByText('Programa de Preparação Avançada para Entrevistas Técnicas'),
    ).toBeVisible();
  });

  test('has the Google login button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible();
  });
});
