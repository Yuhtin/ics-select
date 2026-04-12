import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('shows the login welcome heading and description', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: 'Bem-vindo ao ICS Select' }),
    ).toBeVisible();
    await expect(
      page.getByText('Acesse a plataforma de alta performance do Inteli.'),
    ).toBeVisible();
  });
});
