import { expect, test } from '@playwright/test';

test.describe('Academy Fellow visual identity', () => {
  test('the design-system reference surface uses the Academy brand', async ({ page }) => {
    await page.goto('/dev/design-system');

    await expect(
      page.getByRole('heading', { name: 'Academy Fellow design system' }),
    ).toBeVisible();
    await expect(page.getByText('ICS Select', { exact: true })).toHaveCount(0);
  });

  test('official assets and theme specimens stay readable in either theme', async ({ page }) => {
    await page.goto('/dev/design-system');
    const light = page.locator('main [data-theme="light"]');
    const dark = page.locator('main [data-theme="dark"]');

    await expect(light).toHaveCSS('background-color', 'rgb(243, 243, 241)');
    await expect(dark).toHaveCSS('background-color', 'rgb(16, 16, 19)');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(light.locator('img')).toHaveCSS('filter', 'none');
    await expect(dark.locator('img')).toHaveCSS('filter', 'brightness(0) invert(1)');

    const assets = page.locator('main img');
    for (const asset of await assets.all()) {
      await asset.scrollIntoViewIfNeeded();
      await expect.poll(() => asset.evaluate((element) => {
        const image = element as HTMLImageElement;
        return image.complete && image.naturalWidth > 0;
      })).toBe(true);
    }
    await expect(page.locator('link[href*="fonts.googleapis.com"]')).toHaveCount(0);
  });

  test('the reference fits mobile and respects reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dev/design-system');

    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth,
    )).toBe(true);
    await expect(page.locator('body')).toHaveCSS('transition-duration', '1e-05s');
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  });
});
