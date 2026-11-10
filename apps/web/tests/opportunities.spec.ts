import { expect, test, type Page, type Request } from '@playwright/test';

const API_BASE = 'http://localhost:3001';
const member = {
  id: 'me-1', name: 'Eduardo Santos', email: 'eduardo@test.com',
  role: 'MEMBER', pictureUrl: null, privacyAcceptedAt: '2026-01-01T00:00:00Z',
  whatsappPhone: '+5511999999999', targetTrack: 'BIG_TECH', googleConnected: true,
};

const base = {
  description: null, location: null, workMode: null, compensation: null,
  deadline: null, eventDate: null, links: [], contacts: [], status: 'PUBLISHED',
  createdAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-01T12:00:00Z',
  publishedAt: '2026-11-01T12:00:00Z', isOpen: true, interests: [], interestedByMe: false,
  createdBy: { id: 'admin-1', name: 'Davi Duarte', role: 'ADMIN' },
};

const opportunities = [
  {
    ...base, id: 'stripe', title: 'Summer Internship 2027 — Software Engineer', type: 'SUMMER',
    companyName: 'Stripe', location: 'Dublin', workMode: 'ONSITE', compensation: 'US$ 9k/mês',
    deadline: '2026-11-13', publishedAt: '2026-11-08T12:00:00Z',
    description: '12 semanas no time de Payments Infra.',
    links: [{ label: 'Vaga oficial', url: 'https://stripe.com/jobs/123' }],
    contacts: [{ name: 'Mariana Couto', role: 'University Recruiter', whatsapp: '+55 (11) 98765-4321', email: 'mariana@stripe.com' }],
    interests: [{ userId: 'u2', name: 'Luana Melo', pictureUrl: null, createdAt: '2026-11-09T12:00:00Z' }],
  },
  {
    ...base, id: 'nubank', title: 'Estágio em Engenharia de Software', type: 'INTERNSHIP',
    companyName: 'Nubank', deadline: '2026-11-30', interestedByMe: true,
    interests: [{ userId: 'me-1', name: member.name, pictureUrl: null, createdAt: '2026-11-09T12:00:00Z' }],
  },
  {
    ...base, id: 'cloudwalk', title: 'Backend Engineer (Go)', type: 'CONTRACT',
    companyName: 'CloudWalk', workMode: 'REMOTE',
    createdBy: { id: 'u3', name: 'Rafael Alves', role: 'MEMBER' },
  },
  {
    ...base, id: 'old', title: 'Hackathon antigo', type: 'EVENT', companyName: 'BTG',
    eventDate: '2026-10-01', isOpen: false, status: 'PUBLISHED',
  },
];

async function mockMember(page: Page, list: unknown[] = opportunities) {
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixed = NativeDate.parse('2026-11-10T15:00:00Z');
    window.Date = class extends NativeDate {
      constructor(...args: ConstructorParameters<typeof Date>) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    } as DateConstructor;
    localStorage.setItem('ics_access_token', 'opp-token');
  });
  const requests: Request[] = [];
  await page.route(`${API_BASE}/**`, (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.startsWith('/opportunities')) requests.push(req);
    if (path === '/me') return route.fulfill({ json: member });
    if (path === '/opportunities' && req.method() === 'GET') return route.fulfill({ json: list });
    if (path === '/opportunities' && req.method() === 'POST') {
      return route.fulfill({ json: { ...base, ...req.postDataJSON(), id: 'new', createdBy: { id: member.id, name: member.name, role: 'MEMBER' } } });
    }
    if (path.endsWith('/interest')) return route.fulfill({ json: { ok: true } });
    return route.fulfill({ json: {} });
  });
  return requests;
}

const cards = (page: Page) => page.getByTestId('opportunity-card');

test('shows open opportunities and a collapsed closed section', async ({ page }) => {
  await mockMember(page);
  await page.goto('/me/opportunities');
  await expect(page.getByRole('heading', { name: 'O que está aberto agora' })).toBeVisible();
  await expect(page.getByText('3 oportunidades abertas · 1 fecha esta semana')).toBeVisible();
  await expect(cards(page)).toHaveCount(3);
  await expect(page.getByText('Hackathon antigo')).toBeHidden();
  await page.getByRole('button', { name: /Closed \(1\)/ }).click();
  await expect(page.getByText('Hackathon antigo')).toBeVisible();
});

test('urgent card shows days left', async ({ page }) => {
  await mockMember(page);
  await page.goto('/me/opportunities');
  await expect(page.getByText('Fecha em 3 dias', { exact: false })).toBeVisible();
});

test('Interested chip filters to flagged ones', async ({ page }) => {
  await mockMember(page);
  await page.goto('/me/opportunities');
  await expect(cards(page)).toHaveCount(3);
  await page.getByRole('group', { name: 'Filter' }).getByRole('button', { name: /Interested/ }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText('Nubank');
});

test('toggling interest calls PUT', async ({ page }) => {
  const requests = await mockMember(page);
  await page.goto('/me/opportunities');
  const card = cards(page).filter({ hasText: 'Stripe' });
  const put = page.waitForRequest((r) => r.url().endsWith('/opportunities/stripe/interest') && r.method() === 'PUT');
  await card.getByRole('button', { name: /Interested/ }).click();
  await put;
  // stopPropagation: the card's detail modal must not open
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(requests.some((r) => r.method() === 'PUT')).toBe(true);
});

test('detail modal shows WhatsApp link', async ({ page }) => {
  await mockMember(page);
  await page.goto('/me/opportunities');
  await cards(page).filter({ hasText: 'Stripe' }).getByRole('button', { name: /Summer Internship/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/5511987654321');
  await expect(dialog.getByRole('link', { name: /E-mail/ })).toHaveAttribute('href', 'mailto:mariana@stripe.com');
});

test('member can share an opportunity', async ({ page }) => {
  await mockMember(page);
  await page.goto('/me/opportunities');
  await page.getByRole('button', { name: 'Share an opportunity' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Vaga de Data Engineer');
  await dialog.getByLabel('Company').fill('iFood');
  await dialog.getByLabel('Type').selectOption('FULL_TIME');
  const post = page.waitForRequest((r) => r.url().endsWith('/opportunities') && r.method() === 'POST');
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  const body = (await post).postDataJSON();
  expect(body).toMatchObject({ title: 'Vaga de Data Engineer', companyName: 'iFood', type: 'FULL_TIME' });
  expect(body.status).toBeUndefined();
});

test('editing own opportunity and clearing compensation sends null', async ({ page }) => {
  const own = {
    ...base, id: 'mine', title: 'Freela de landing page', type: 'FREELANCE', companyName: 'AgroSense',
    compensation: 'R$ 4.000', createdBy: { id: member.id, name: member.name, role: 'MEMBER' },
  };
  await mockMember(page, [own]);
  await page.goto('/me/opportunities');
  await cards(page).first().getByRole('button', { name: own.title }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Compensation')).toHaveValue('R$ 4.000');
  await dialog.getByLabel('Compensation').fill('');
  const patch = page.waitForRequest((r) => r.url().endsWith('/opportunities/mine') && r.method() === 'PATCH');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  const body = (await patch).postDataJSON();
  expect(body).toHaveProperty('compensation', null);
  expect(body.status).toBeUndefined();
});

test('empty state offers to share', async ({ page }) => {
  await mockMember(page, []);
  await page.goto('/me/opportunities');
  await expect(page.getByText('Nothing open right now.')).toBeVisible();
});

test('nav shows Opportunities', async ({ page }) => {
  await mockMember(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/me/opportunities');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Opportunities', exact: true })).toHaveAttribute('aria-current', 'page');
});

for (const width of [375, 1280, 1920]) {
  test(`no horizontal scroll and cards ≤ 380px at ${width}px`, async ({ page }) => {
    await mockMember(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/me/opportunities');
    await expect(cards(page)).toHaveCount(3);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const box of await cards(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))) {
      expect(box).toBeLessThanOrEqual(380);
    }
  });
}
