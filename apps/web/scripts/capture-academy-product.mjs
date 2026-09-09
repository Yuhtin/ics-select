import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1440, height: 1050 },
  });
  await page.addInitScript(() => localStorage.setItem('ics-theme', 'light'));
  await page.goto('http://127.0.0.1:3000/dev/me-preview');
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  const preview = page.getByTestId('academy-member-preview');
  await preview.waitFor({ state: 'visible' });
  for (const image of await preview.locator('img').all()) {
    await image.evaluate((element) => element.decode());
  }
  await preview.screenshot({
    animations: 'disabled',
    path: fileURLToPath(new URL('../public/landing/product-me-home.png', import.meta.url)),
  });
} finally {
  await browser.close();
}
