import { expect, test, type Page } from '@playwright/test';

test.use({ timezoneId: 'America/Sao_Paulo' });

const waitlistSnapshotOptions = {
  animations: 'disabled' as const,
  // Isolate the dialog from the blurred page at fractional screenshot edges.
  style: '.landing-stage, .landing-topbar, footer { visibility: hidden !important; }',
};

async function mockLanding(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('http://localhost:3001/public/cohort', (route) => route.fulfill({ json: {
    cycle: '2026.2', members: [
      { name: 'Mariana Costa', avatar: '/landing/av-mp.png' },
      { name: 'João Lima', avatar: null },
    ],
  } }));
  await page.route('http://localhost:3001/waitlist/config', (route) => route.fulfill({ json: {
    cycleTarget: '2026.3', startsAt: '2026-07-01T15:00:00Z',
  } }));
}

test('landing brand and login have mobile touch targets', async ({ page }) => {
  await mockLanding(page);
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto('/');
  for (const name of ['Academy Fellow', 'Sou fellow']) {
    const control = page.getByRole('banner').getByRole('link', { name, exact: true });
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect.soft(box!.width).toBeGreaterThanOrEqual(44);
    expect.soft(box!.height).toBeGreaterThanOrEqual(44);
  }
});

for (const width of [390, 768, 1440]) {
  test(`landing at ${width}px`, async ({ page }) => {
    await mockLanding(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await expect(page.getByText('Academy Fellow', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /sou fellow/i })).toHaveAttribute('href', '/login');
    await expect(page.getByText(/ICS Select|Inteli Consulting Society/)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('O caminho disciplinado pra tech de elite');
    await expect(page.getByText('Sempre 12 ativos.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quero conhecer' })).toBeInViewport();
    await expect(page.getByText('Ciclo 2026.3 · abre em Julho', { exact: false }).first()).toBeInViewport();
    if (width >= 1024) {
      const headline = page.getByRole('heading', { level: 1 });
      const lines = await headline.evaluate((element) => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight));
      expect(lines).toBeLessThanOrEqual(2.1);
      const header = await page.getByRole('banner').boundingBox();
      expect(header?.height).toBeGreaterThanOrEqual(64);
      expect(header?.height).toBeLessThanOrEqual(72);
    }
    for (const id of ['top', 'como-funciona', 'program', 'cohorts', 'apply']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(page.getByText('2026.2 · 2 selecionados no ciclo atual')).toBeVisible();
    await expect(page.getByText('Mariana Costa')).toBeVisible();
    for (const name of ['Apple', 'Google', 'Amazon', 'Meta', 'Netflix', 'BCG X', 'Brex', 'QuantumBlack', 'xAI', 'Anthropic', 'OpenAI']) {
      await expect(page.getByRole('img', { name, exact: true })).toHaveCount(1);
    }
    await expect(page.getByText('+ 24 outras', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Davi Duarte/ })).toHaveAttribute('href', 'https://www.linkedin.com/in/daviduarte/');
    for (const asset of await page.locator('main img').all()) {
      await asset.scrollIntoViewIfNeeded();
      await expect.poll(() => asset.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
      await asset.evaluate(async (element) => {
        const image = element as HTMLImageElement;
        // Chromium full-page capture can omit offscreen async-decoded images.
        image.decoding = 'sync';
        await image.decode();
      });
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const section of await page.locator('.reveal').all()) {
      await expect(section).toHaveCSS('opacity', '1');
      await expect(section).toHaveCSS('transform', 'none');
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveScreenshot(`academy-landing-${width}.png`, { fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'Quero conhecer' }).click();
    await expect(page).toHaveURL(/#cohorts$/);
    await expect(page.getByRole('button', { name: 'Entrar na seleção' })).toBeInViewport();
    if (width >= 768) {
      await page.getByRole('link', { name: 'Programa', exact: true }).click();
      await expect(page).toHaveURL(/#como-funciona$/);
      await expect(page.getByRole('heading', { name: 'Três coisas. Nada mais.' })).toBeInViewport();
    }
  });
}

test('landing waitlist preserves keyboard flow, validation, payload, failure and success', async ({ page }) => {
  await mockLanding(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByText('Mariana Costa')).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Entrar na seleção' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Entre na seleção.' });
  await expect(dialog).toBeVisible();
  const name = dialog.getByLabel('Qual seu nome?');
  await expect(name).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Fechar' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Continuar' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('Preenche teu nome.')).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(name).toBeFocused();
  await page.keyboard.type('  Ana Silva  ');
  await page.keyboard.press('Enter');
  const email = dialog.getByLabel('Seu email Inteli');
  await expect(email).toBeFocused();
  await page.keyboard.type('ana@example.com');
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('Precisa ser um email @sou.inteli.edu.br')).toBeVisible();
  await email.fill('ANA@sou.inteli.edu.br');
  await page.keyboard.press('Enter');
  const course = dialog.getByRole('button', { name: 'Ciência da Computação', exact: true });
  await expect(course).toBeFocused();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '2º', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  await expect(dialog.getByRole('radio', { name: '3', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(dialog).toHaveScreenshot('academy-waitlist-context-mobile.png', waitlistSnapshotOptions);
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const github = dialog.getByLabel('GitHub (opcional)');
  await expect(github).toBeFocused();
  await page.keyboard.type('https://github.com/ana');
  await page.keyboard.press('Tab');
  await page.keyboard.type('https://linkedin.com/in/ana');
  await expect(dialog).toHaveScreenshot('academy-waitlist-mobile.png', waitlistSnapshotOptions);
  await page.route('http://localhost:3001/waitlist', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ status: 500, json: {} });
  });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
  await expect(dialog.getByText('Não foi possível enviar. Tenta de novo em instantes.')).toBeVisible();
  await page.route('http://localhost:3001/waitlist', (route) => route.fulfill({ json: { ok: true } }));
  // Disabling a submitting button releases browser focus; Tab re-enters the dialog.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Enviar inscrição' })).toBeFocused();
  const request = page.waitForRequest((request) => request.url().endsWith('/waitlist') && request.method() === 'POST');
  await page.keyboard.press('Enter');
  expect((await request).postDataJSON()).toEqual({
    name: 'Ana Silva', email: 'ana@sou.inteli.edu.br', course: 'CIENCIA_COMPUTACAO',
    year: 2, skillLevel: 3, github: 'https://github.com/ana', linkedin: 'https://linkedin.com/in/ana', website: '',
  });
  await expect(page.getByRole('heading', { name: 'Inscrição recebida.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(name).toBeFocused();
  await expect(name).toHaveValue('');
});

test('landing keeps closed-cycle and unavailable-cohort states usable', async ({ page }) => {
  await mockLanding(page);
  await page.route('http://localhost:3001/public/cohort', (route) => route.fulfill({ status: 500, json: {} }));
  await page.route('http://localhost:3001/waitlist/config', (route) => route.fulfill({ json: { cycleTarget: null, startsAt: null } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar na seleção' }).click();
  await expect(page.getByText('Próximo ciclo ainda não anunciado')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aguardando abertura' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Entrar na seleção' })).toBeFocused();
});

test('landing sections reveal once and remain visible when reduced motion changes', async ({ page }) => {
  await mockLanding(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const hero = page.locator('.landing-hero-copy');
  await expect(hero).toHaveCSS('opacity', '1');
  const pillars = page.locator('#como-funciona .reveal').first();
  await pillars.scrollIntoViewIfNeeded();
  await expect(pillars).toHaveCSS('opacity', '1');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(pillars).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const section of await page.locator('.reveal').all()) {
    await expect(section).toHaveCSS('opacity', '1');
    await expect(section).toHaveCSS('transform', 'none');
  }
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length)).toBe(0);
});

const MEMBER_API = 'http://localhost:3001';
const memberUser = {
  id: 'academy-member', name: 'Eduardo Santos', email: 'eduardo@example.com',
  role: 'MEMBER', pictureUrl: null, privacyAcceptedAt: '2026-01-01T00:00:00Z',
  whatsappPhone: '+5511999999999', targetTrack: 'BIG_TECH', googleConnected: true,
};
const memberItem = {
  id: 'binary-search', planId: 'plan-1', order: 1, title: 'Binary search patterns',
  format: 'PROBLEM', estimatedMinutes: 45, url: 'https://leetcode.com/problems/binary-search',
  topic: { slug: 'binary-search', label: 'Binary Search' }, outcome: 'PENDING',
  skippable: true, scheduledAt: '2026-04-17T19:00:00Z', scheduledMinutes: 45,
  carriedFromItemId: null,
};
const memberHome = {
  hero: { state: 'now', item: memberItem }, today: [memberItem], late: [], days: [],
  unscheduled: [], streak: { current: 7, last7: [true, true, true, true, true, true, true] },
  carryOverReflection: null, topicCoverage: [],
};
const memberDetail = {
  ...memberItem, reflection: null, completedAt: null,
  libraryItem: { ...memberItem, description: 'Practice classic, lower-bound, and upper-bound binary search.' },
  carriedFrom: { outcome: 'STUCK', reflection: 'Revisar o invariante antes de começar.', completedAt: '2026-04-10T19:00:00Z', weekStart: '2026-04-06' },
};
const memberCalendar = {
  weekStart: '2026-04-12', weekEnd: '2026-04-18', timezone: 'America/Sao_Paulo', hasGoogleConnection: true,
  events: [
    { id: 'study-1', kind: 'ICS', title: memberItem.title, start: '2026-04-17T19:00:00Z', end: '2026-04-17T19:45:00Z', allDay: false, ics: { ...memberItem, itemId: memberItem.id } },
    { id: 'external-1', kind: 'EXTERNAL', title: 'Mentor office hours', start: '2026-04-16T17:00:00Z', end: '2026-04-16T18:00:00Z', allDay: false, meetLink: 'https://meet.google.com/example', location: 'Campus' },
  ],
};

async function mockMemberProduct(page: Page, theme: 'light' | 'dark') {
  // Freeze only Date: Playwright's Intl shim conflicts with temporal-polyfill/global.
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixed = NativeDate.parse('2026-04-17T19:00:00Z');
    window.Date = class extends NativeDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(...(args.length ? args : [fixed]));
      }
      static now() { return fixed; }
    } as DateConstructor;
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((value) => {
    localStorage.setItem('ics_access_token', 'fake-member-token');
    localStorage.setItem('ics-theme', value);
  }, theme);
  const responses: Record<string, unknown> = {
    '/me': memberUser,
    '/me/home': memberHome,
    '/me/item/binary-search': memberDetail,
    '/me/calendar': memberCalendar,
    '/me/cohort': {
      cycleName: '2026.1', memberCount: 2, weekEndsAt: null,
      members: [
        { userId: memberUser.id, ...memberUser, isMe: true },
        { userId: 'maria', name: 'Maria Oliveira', email: 'maria@example.com', pictureUrl: null, isMe: false },
      ],
      ranking: [
        { userId: 'maria', name: 'Maria Oliveira', pictureUrl: null, score: 92, isMe: false },
        { userId: memberUser.id, name: memberUser.name, pictureUrl: null, score: 88, isMe: true },
      ],
      feed: [{ id: 'activity-1', kind: 'finished', at: '2026-04-17T18:00:00Z', member: { id: 'maria', name: 'Maria Oliveira', pictureUrl: null }, itemTitle: 'Recursion intro', itemId: 'recursion' }],
    },
    '/me/retro/current': { open: false, retro: null, weekRecap: null, windowOpensAt: '2026-04-17T21:00:00Z', windowClosesAt: '2026-04-22T23:59:00Z' },
  };
  await page.route(`${MEMBER_API}/**`, (route) => route.fulfill({ json: responses[new URL(route.request().url()).pathname] ?? {} }));
}

for (const theme of ['light', 'dark'] as const) {
  test(`member outcome form has mobile touch targets and sans validation in ${theme}`, async ({ page }) => {
    await mockMemberProduct(page, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/me/item/binary-search');
    await page.getByRole('button', { name: /Nailed it$/ }).click();
    const minutes = page.getByRole('spinbutton');
    await expect(minutes).toBeVisible();
    const bounds = await minutes.boundingBox();
    expect.soft(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    await minutes.fill('0');
    const validation = page.getByText('Use um número inteiro entre 1 e 1440.');
    await expect(validation).toBeVisible();
    const sansFont = await page.locator('body').evaluate((body) => getComputedStyle(body).fontFamily);
    await expect.soft(validation).toHaveCSS('font-family', sansFont);
    await expect(page.getByRole('button', { name: 'Save outcome' })).toBeDisabled();
    await minutes.fill('45');
    await expect(validation).toBeHidden();
    await expect(page.getByRole('button', { name: 'Save outcome' })).toBeEnabled();
  });

  test(`member routes and actions remain usable in ${theme}`, async ({ page }) => {
    await mockMemberProduct(page, theme);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/me');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await expect(page.getByRole('heading', { name: memberItem.title })).toBeVisible();
    await expect(page).toHaveScreenshot(`academy-home-route-${theme}.png`, { fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'Start study' }).click();
    await expect(page).toHaveURL(/\/me\/item\/binary-search$/);
    await expect(page.getByRole('link', { name: 'Open on LeetCode' })).toHaveAttribute('href', memberItem.url);
    await expect(page.getByText('Revisar o invariante antes de começar.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /Nailed it$/ }).click();
    const minutes = page.getByRole('spinbutton');
    await expect(page.getByRole('button', { name: 'Save outcome' })).toBeDisabled();
    await minutes.fill('0');
    await expect(page.getByText('Use um número inteiro entre 1 e 1440.')).toBeVisible();
    await minutes.fill('45');
    await expect(page).toHaveScreenshot(`academy-item-route-${theme}.png`, { fullPage: true, animations: 'disabled' });
    const outcomeRequest = page.waitForRequest((request) => request.url().endsWith('/plans/plan-1/items/binary-search/outcome') && request.method() === 'PATCH');
    await page.getByRole('button', { name: 'Save outcome' }).click();
    expect((await outcomeRequest).postDataJSON()).toEqual({ outcome: 'DONE_EASY', reflection: undefined, actualMinutes: 45 });

    await page.goto('/me/plan');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await expect(page).toHaveURL(/\/me\/calendar$/);
    await expect(page.getByText('This week · 1 Academy Fellow')).toBeVisible();
    await expect(page.getByText('Mentor office hours')).toBeVisible();
    await expect(page).toHaveScreenshot(`academy-calendar-route-${theme}.png`, { fullPage: true, animations: 'disabled' });
    await page.getByText(memberItem.title, { exact: true }).last().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Início').fill('2026-04-17T17:00');
    await dialog.getByLabel('Fim', { exact: true }).fill('2026-04-17T16:00');
    await dialog.getByRole('button', { name: 'Reagendar', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('O fim precisa ser depois do início.');
    await dialog.getByLabel('Fim', { exact: true }).fill('2026-04-17T17:45');
    const rescheduleRequest = page.waitForRequest((request) => request.url().endsWith('/me/calendar/events/study-1') && request.method() === 'PATCH');
    await dialog.getByRole('button', { name: 'Reagendar', exact: true }).click();
    expect((await rescheduleRequest).postDataJSON()).toEqual({ start: '2026-04-17T20:00:00Z', end: '2026-04-17T20:45:00Z' });
    await expect(dialog).toBeHidden();

    await page.goto('/me/cohort');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await expect(page.getByRole('heading', { name: '2 classmates this cycle' })).toBeVisible();
    await expect(page.getByText('Recursion intro')).toBeVisible();
    await expect(page).toHaveScreenshot(`academy-cohort-route-${theme}.png`, { fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`member empty, loading and failure states in ${theme}`, async ({ page }) => {
    await mockMemberProduct(page, theme);
    await page.route(`${MEMBER_API}/me/home`, (route) => route.fulfill({ json: { ...memberHome, hero: null, today: [] } }));
    await page.goto('/me');
    await expect(page.getByRole('heading', { name: 'Waiting for the next plan.' })).toBeVisible();
    await expect(page.getByText('Nothing scheduled.')).toBeVisible();
    for (const state of ['all_done', 'free_day'] as const) {
      await page.route(`${MEMBER_API}/me/home`, (route) => route.fulfill({ json: { ...memberHome, hero: { state, nextAt: null }, today: [] } }));
      await page.reload();
      await expect(page.getByRole('heading', { name: state === 'all_done' ? 'Nothing more scheduled today.' : 'No study scheduled today.' })).toBeVisible();
    }
    for (const state of ['up_next', 'running_late'] as const) {
      await page.route(`${MEMBER_API}/me/home`, (route) => route.fulfill({ json: { ...memberHome, hero: { state, item: memberItem, minutesUntil: 30, minutesLate: 30 } } }));
      await page.reload();
      await expect(page.getByRole('heading', { name: memberItem.title })).toBeVisible();
      await expect(page.getByRole('link', { name: state === 'up_next' ? 'Open' : 'Catch up', exact: true })).toHaveAttribute('href', '/me/item/binary-search');
    }
    await page.route(`${MEMBER_API}/me/home`, (route) => route.fulfill({ status: 500, json: { message: 'Unavailable' } }));
    await page.reload();
    await expect(page.getByText('Could not load your home.')).toBeVisible({ timeout: 15000 });
    await page.route(`${MEMBER_API}/me/calendar?*`, (route) => route.fulfill({ json: { ...memberCalendar, events: [], hasGoogleConnection: false } }));
    await page.goto('/me/calendar');
    await expect(page.getByText('No study blocks this week.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Connect Google Calendar' })).toHaveAttribute('href', '/auth/google');
    await page.route(`${MEMBER_API}/me/cohort`, (route) => route.fulfill({ json: { cycleName: '', memberCount: 0, members: [], feed: [] } }));
    await page.goto('/me/cohort');
    await expect(page.getByRole('heading', { name: 'No cohort yet.' })).toBeVisible();
    await expect(page.getByText('No activity in the last 7 days.')).toBeVisible();
    await page.route(`${MEMBER_API}/me/item/binary-search`, async (route) => { await new Promise((resolve) => setTimeout(resolve, 700)); await route.fulfill({ status: 404, json: {} }); });
    await page.goto('/me/item/binary-search');
    await expect(page.getByText('Loading…', { exact: true })).toBeVisible();
    await expect(page.getByText('Item not found.')).toBeVisible({ timeout: 15000 });
  });
}

for (const theme of ['light', 'dark'] as const) {
  for (const width of [390, 1440]) {
    test(`member reference ${theme} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((selectedTheme) => localStorage.setItem('ics-theme', selectedTheme), theme);
      await page.goto('/dev/me-preview');
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      await expect(page.getByTestId('academy-member-preview')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page).toHaveScreenshot(`academy-member-${theme}-${width}.png`, {
        animations: 'disabled',
        fullPage: true,
      });
    });
  }
}

test('login uses Academy Fellow branding', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await expect(page.getByText('Academy Fellow', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /(?:entrar|continuar) com google/i })).toBeVisible();
  await expect(page.getByText(/ICS Select|Inteli Consulting Society/)).toHaveCount(0);
  await expect(page).toHaveScreenshot('academy-login-desktop.png', {
    animations: 'disabled',
    fullPage: true,
  });
});

for (const theme of ['light', 'dark'] as const) {
  test(`login fits mobile in ${theme} with a keyboard-accessible OAuth link`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((value) => localStorage.setItem('ics-theme', value), theme);
    await page.goto('/login');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    const login = page.getByRole('link', { name: 'Entrar com Google' });
    await expect(login).toHaveAttribute('href', 'http://localhost:3001/auth/google');
    await page.keyboard.press('Tab');
    await expect(login).toBeFocused();
    await expect(login).not.toHaveCSS('box-shadow', 'none');
    expect((await login.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const image = page.getByAltText('Comunidade Inteli Academy reunida no campus do Inteli');
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page).toHaveScreenshot(`academy-login-mobile-${theme}.png`, { fullPage: true, animations: 'disabled' });
  });
}

for (const [error, title, body] of [
  ['account_disabled', 'Acesso encerrado', 'Sua participação no Academy Fellow foi encerrada.'],
  ['not_invited', 'Email não autorizado', 'Sua conta ainda não foi convidada para o Academy Fellow.'],
  ['auth_retry', 'Login falhou — tenta de novo', 'O Google rejeitou esse login'],
] as const) {
  test(`login preserves the ${error} announcement`, async ({ page }) => {
    await page.goto(`/login?error=${error}`);
    await expect(page.getByRole('main').getByRole('alert')).toContainText(title);
    await expect(page.getByRole('main').getByRole('alert')).toContainText(body);
    await expect(page.getByRole('link', { name: 'Entrar com Google' })).toHaveAttribute('href', 'http://localhost:3001/auth/google');
    await expect(page.getByText(/ICS Select|Inteli Consulting Society/)).toHaveCount(0);
  });
}

test('unknown login errors do not create an announcement', async ({ page }) => {
  await page.goto('/login?error=unknown');
  await expect(page.getByRole('link', { name: 'Entrar com Google' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});

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
