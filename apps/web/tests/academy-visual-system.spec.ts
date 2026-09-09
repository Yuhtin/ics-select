import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  for (const width of [390, 1440]) {
    test(`design system is coherent in ${theme} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(
        (selectedTheme) => localStorage.setItem('ics-theme', selectedTheme),
        theme,
      );
      await page.goto('/dev/design-system');
      // Next.js's animated development indicator is outside the product UI.
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const asset of await page.locator('main img').all()) {
        await asset.scrollIntoViewIfNeeded();
        await expect.poll(() => asset.evaluate((element) => {
          const image = element as HTMLImageElement;
          return image.complete && image.naturalWidth > 0;
        })).toBe(true);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth,
      )).toBe(true);
      await expect(page).toHaveScreenshot(`academy-design-system-${theme}-${width}.png`, {
        animations: 'disabled',
        fullPage: true,
      });

      const primary = page.getByRole('button', { name: 'Primary', exact: true });
      await primary.focus();
      await expect(primary).toBeFocused();
      await expect(primary).not.toHaveCSS('box-shadow', 'none');
      for (const control of await page.locator('main button:visible').all()) {
        const bounds = await control.boundingBox();
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
      }

      await page.getByRole('button', { name: 'Already known' }).click();
      await expect(page.getByRole('button', { name: 'Already known' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText('current: SKIPPED')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nailed it' }).last()).toBeDisabled();

      await page.getByRole('button', { name: 'Abrir confirmação' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveScreenshot(`academy-confirm-dialog-${theme}-${width}.png`, { animations: 'disabled' });
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: 'Abrir confirmação' })).toBeFocused();
      await page.getByRole('button', { name: 'Abrir confirmação' }).click();
      await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('status')).toHaveText('Exemplo confirmado.');

      await page.getByRole('button', { name: 'Ver sugestões' }).click();
      await expect(page.getByRole('status')).toHaveText('Sugestões selecionadas.');
      await page.getByRole('button', { name: 'Ver plano' }).first().click();
      await expect(page.getByRole('status')).toHaveText('Plano selecionado.');
      await page.getByRole('button', { name: 'Ver detalhes' }).first().click();
      await expect(page.getByRole('status')).toHaveText('Detalhes selecionados.');
      await page.getByRole('button', { name: /Binary search patterns/ }).click();
      await expect(page.getByRole('status')).toHaveText('Atividade selecionada.');
    });
  }
}

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
