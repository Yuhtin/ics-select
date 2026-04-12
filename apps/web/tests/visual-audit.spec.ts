import { test, expect, type Page, type Route } from '@playwright/test';

// ============================================================================
// Visual + functional audit of every authenticated page in ICS Select.
// Backend is mocked entirely via page.route(); no live API required.
// ============================================================================

// ---------- Mock data ----------

const ADMIN_USER = {
  id: 'u-admin',
  email: 'admin@inteli.edu.br',
  name: 'Davi Admin',
  pictureUrl: null,
  role: 'ADMIN' as const,
  privacyAcceptedAt: '2026-01-01T00:00:00Z',
};

const MEMBER_USER = {
  id: 'u-member',
  email: 'alice@sou.inteli.edu.br',
  name: 'Alice Silva',
  pictureUrl: null,
  role: 'MEMBER' as const,
  privacyAcceptedAt: '2026-01-01T00:00:00Z',
};

const CYCLES_LIST = [
  {
    id: 'c-2026-1',
    name: '2026.1',
    startsAt: '2026-02-01T00:00:00Z',
    endsAt: '2026-06-30T00:00:00Z',
    status: 'ACTIVE' as const,
  },
  {
    id: 'c-2025-2',
    name: '2025.2',
    startsAt: '2025-08-01T00:00:00Z',
    endsAt: '2025-12-15T00:00:00Z',
    status: 'ARCHIVED' as const,
  },
];

const CYCLE_DETAIL = {
  id: 'c-2026-1',
  name: '2026.1',
  startsAt: '2026-02-01T00:00:00Z',
  endsAt: '2026-06-30T00:00:00Z',
  status: 'ACTIVE',
  memberships: [
    {
      id: 'mem-1',
      user: {
        id: 'm-1',
        name: 'Alice Silva',
        email: 'alice@sou.inteli.edu.br',
        pictureUrl: null,
      },
    },
    {
      id: 'mem-2',
      user: {
        id: 'm-2',
        name: 'Bruno Costa',
        email: 'bruno@sou.inteli.edu.br',
        pictureUrl: null,
      },
    },
  ],
};

const DASHBOARD_MEMBERS = [
  {
    id: 'm-1',
    name: 'Alice Silva',
    email: 'alice@sou.inteli.edu.br',
    pictureUrl: null,
    role: 'MEMBER',
    stats: { plansCount: 4, doneItems: 18, stuckItems: 1 },
  },
  {
    id: 'm-2',
    name: 'Bruno Costa',
    email: 'bruno@sou.inteli.edu.br',
    pictureUrl: null,
    role: 'MEMBER',
    stats: { plansCount: 4, doneItems: 12, stuckItems: 3 },
  },
  {
    id: 'm-3',
    name: 'Carla Mendes',
    email: 'carla@sou.inteli.edu.br',
    pictureUrl: null,
    role: 'MEMBER',
    stats: { plansCount: 3, doneItems: 22, stuckItems: 0 },
  },
];

const LIBRARY_ITEMS = [
  {
    id: 'li-1',
    title: 'Two Pointers, do zero ao expert',
    description: 'Vídeo explicando a técnica de dois ponteiros com exemplos LeetCode.',
    url: 'https://example.com/two-pointers',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 45,
    source: 'NeetCode',
    tags: ['arrays', 'two-pointers'],
  },
  {
    id: 'li-2',
    title: 'Grafos: BFS e DFS',
    description: 'Artigo cobrindo travessias em grafos.',
    url: 'https://example.com/graphs',
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 30,
    source: 'CP-Algorithms',
    tags: ['graphs', 'bfs', 'dfs'],
  },
  {
    id: 'li-3',
    title: 'Problema: Merge K Sorted Lists',
    description: 'Resolva usando heap.',
    url: 'https://leetcode.com/problems/merge-k-sorted-lists',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 60,
    source: 'LeetCode',
    tags: ['heap', 'linked-list'],
  },
];

const WEEK_PLAN = {
  id: 'p-week-1',
  status: 'PUBLISHED',
  weekStart: '2026-04-06T00:00:00Z',
  weekEnd: '2026-04-12T00:00:00Z',
  items: [
    {
      id: 'pi-1',
      status: 'DONE',
      order: 0,
      stuck: false,
      difficultyRating: 'EASY' as const,
      reflection: 'Tranquilo, já tinha visto na aula.',
      libraryItem: {
        id: 'li-1',
        title: 'Two Pointers, do zero ao expert',
        description: 'Vídeo explicando a técnica de dois ponteiros.',
        estimatedMinutes: 45,
        url: 'https://example.com/two-pointers',
        format: 'VIDEO',
      },
      sessions: [
        { id: 's-1', scheduledAt: '2026-04-07T14:00:00Z', durationMinutes: 45 },
      ],
    },
    {
      id: 'pi-2',
      status: 'PENDING',
      order: 1,
      stuck: false,
      difficultyRating: null,
      reflection: null,
      libraryItem: {
        id: 'li-2',
        title: 'Grafos: BFS e DFS',
        description: 'Artigo cobrindo travessias em grafos.',
        estimatedMinutes: 30,
        url: 'https://example.com/graphs',
        format: 'ARTICLE',
      },
      sessions: [],
    },
    {
      id: 'pi-3',
      status: 'PENDING',
      order: 2,
      stuck: true,
      difficultyRating: null,
      reflection: null,
      libraryItem: {
        id: 'li-3',
        title: 'Problema: Merge K Sorted Lists',
        description: 'Resolva usando heap.',
        estimatedMinutes: 60,
        url: 'https://leetcode.com/problems/merge-k-sorted-lists',
        format: 'PROBLEM',
      },
      sessions: [],
    },
    {
      id: 'pi-4',
      status: 'PENDING',
      order: 3,
      stuck: false,
      difficultyRating: null,
      reflection: null,
      libraryItem: {
        id: 'li-4',
        title: 'DP em árvores',
        description: 'Problema clássico de programação dinâmica em árvores.',
        estimatedMinutes: 50,
        url: null,
        format: 'ARTICLE',
      },
      sessions: [],
    },
  ],
};

const AVAILABILITY = {
  mondayMinutes: 60,
  tuesdayMinutes: 45,
  wednesdayMinutes: 90,
  thursdayMinutes: 30,
  fridayMinutes: 60,
  saturdayMinutes: 120,
  sundayMinutes: 0,
  preferredSessionMinutes: 60,
  timezone: 'America/Sao_Paulo',
};

const MEMBER_OVERVIEW = {
  user: {
    id: 'm-1',
    name: 'Alice Silva',
    email: 'alice@sou.inteli.edu.br',
    pictureUrl: null,
  },
  plans: [
    {
      id: 'p-1',
      weekStart: '2026-04-06T00:00:00Z',
      weekEnd: '2026-04-12T00:00:00Z',
      status: 'PUBLISHED',
      doneCount: 3,
      totalCount: 5,
    },
  ],
  topicCoverage: [
    { tag: 'arrays', done: 5, total: 8 },
    { tag: 'graphs', done: 2, total: 6 },
    { tag: 'dp', done: 1, total: 4 },
  ],
};

const CLASSES = [
  {
    id: 'cls-1',
    title: 'Kickoff: algoritmos de busca',
    topic: 'Binary Search',
    scheduledAt: '2026-04-10T19:00:00Z',
  },
];

// ---------- Route installer ----------

async function installCommonMocks(
  page: Page,
  user: typeof ADMIN_USER | typeof MEMBER_USER,
): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('ics_access_token', 'fake.jwt');
  });

  const json = async (
    route: Route,
    data: unknown,
    status = 200,
  ): Promise<void> => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  };

  // Single catch-all on the API host so we don't accidentally intercept
  // Next.js page navigations (which share path prefixes with API routes).
  const API_HOST_PREFIX = 'http://localhost:3001';

  await page.route(`${API_HOST_PREFIX}/**`, async (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const path = url.pathname;

    // --- AUTH ---
    if (path === '/auth/logout') {
      return route.fulfill({ status: 204, body: '' });
    }
    if (path === '/auth/refresh') {
      return route.fulfill({ status: 401, body: '' });
    }

    // --- ME ---
    if (path === '/me') {
      return json(route, user);
    }
    if (path === '/me/week') {
      return json(route, [WEEK_PLAN]);
    }
    if (path === '/me/availability') {
      if (method === 'PATCH') {
        return json(route, {
          ...AVAILABILITY,
          ...(req.postDataJSON() ?? {}),
        });
      }
      return json(route, AVAILABILITY);
    }
    if (path === '/me/privacy/accept') {
      return json(route, { ok: true });
    }

    // --- PLANS ---
    const planDone = path.match(/^\/plans\/([^/]+)\/items\/([^/]+)\/done$/);
    if (planDone) return json(route, { ok: true });
    const planStuck = path.match(/^\/plans\/([^/]+)\/items\/([^/]+)\/stuck$/);
    if (planStuck) return json(route, { ok: true });
    const planPublish = path.match(/^\/plans\/([^/]+)\/publish$/);
    if (planPublish) return json(route, { ok: true, overflow: [] });
    const planDetail = path.match(/^\/plans\/([^/]+)$/);
    if (planDetail) return json(route, WEEK_PLAN);

    // --- ADMIN DASHBOARD ---
    if (path === '/admin/dashboard') {
      return json(route, DASHBOARD_MEMBERS);
    }
    const memberOverview = path.match(/^\/admin\/members\/([^/]+)\/overview$/);
    if (memberOverview) return json(route, MEMBER_OVERVIEW);

    // --- CYCLES ---
    if (path === '/cycles') {
      if (method === 'POST') {
        const body = req.postDataJSON() ?? {};
        return json(route, { id: 'c-new', status: 'ACTIVE', ...body }, 201);
      }
      return json(route, CYCLES_LIST);
    }
    const cycleReport = path.match(/^\/cycles\/([^/]+)\/report$/);
    if (cycleReport) {
      return route.fulfill({
        status: 200,
        contentType: 'text/markdown',
        body: '# Relatório do Ciclo 2026.1\n\nResumo executivo.',
      });
    }
    const cycleClasses = path.match(/^\/cycles\/([^/]+)\/classes$/);
    if (cycleClasses) {
      if (method === 'POST') {
        const body = req.postDataJSON() ?? {};
        return json(route, {
          id: 'cls-new',
          title: body.title,
          topic: body.topic,
          scheduledAt: body.scheduledAt,
        });
      }
      return json(route, CLASSES);
    }
    const cycleDetail = path.match(/^\/cycles\/([^/]+)$/);
    if (cycleDetail) return json(route, CYCLE_DETAIL);

    // --- CLASSES (attendance) ---
    const attendance = path.match(/^\/classes\/([^/]+)\/attendance$/);
    if (attendance) {
      if (method === 'POST') return json(route, { ok: true });
      return json(route, []);
    }

    // --- LIBRARY ---
    if (path === '/library') {
      if (method === 'POST') {
        const body = req.postDataJSON() ?? {};
        return json(route, { id: 'li-new', ...body });
      }
      return json(route, LIBRARY_ITEMS);
    }
    if (path === '/library/search') {
      return json(route, { data: LIBRARY_ITEMS });
    }
    if (path === '/library/import') {
      const body = req.postDataJSON() ?? {};
      return json(route, {
        title: 'Material importado',
        description: 'Descrição extraída automaticamente.',
        format: 'ARTICLE',
        difficulty: 'MEDIUM',
        estimatedMinutes: 25,
        source: 'example.com',
        url: body.url ?? 'https://example.com',
      });
    }
    const libItem = path.match(/^\/library\/([^/]+)$/);
    if (libItem) {
      if (method === 'DELETE') {
        return route.fulfill({ status: 204, body: '' });
      }
      if (method === 'PATCH') {
        const body = req.postDataJSON() ?? {};
        return json(route, { ...LIBRARY_ITEMS[0], ...body });
      }
      return json(route, LIBRARY_ITEMS[0]);
    }

    // --- MEMBERS ---
    if (path === '/members') {
      return json(route, DASHBOARD_MEMBERS);
    }
    const memberDiagnose = path.match(/^\/members\/([^/]+)\/diagnose$/);
    if (memberDiagnose) {
      return json(route, {
        markdown:
          '# Diagnóstico\n\n**Pontos fortes:** arrays.\n**Gaps:** grafos, DP.',
        cached: false,
      });
    }
    const memberChat = path.match(/^\/members\/([^/]+)\/chat$/);
    if (memberChat) {
      const sse =
        'data: {"token":"Olá"}\n\n' +
        'data: {"token":", aqui vai uma resposta."}\n\n' +
        'data: [DONE]\n\n';
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse,
      });
    }
    const memberPlans = path.match(/^\/members\/([^/]+)\/plans$/);
    if (memberPlans) return json(route, { id: 'p-new' });

    // --- AI ---
    if (path === '/ai/draft-plan') {
      return json(route, {
        draft: {
          items: [],
          narrative: 'Rascunho de exemplo.',
          totalMinutes: 0,
        },
      });
    }
    if (path === '/ai/brief-plan') {
      return json(route, {
        draft: {
          items: [],
          narrative: 'Brief de exemplo.',
          totalMinutes: 0,
        },
      });
    }
    if (path === '/ai/usage') {
      return json(route, { rows: [], totalCost: 0 });
    }

    // Default: empty 200 JSON to avoid hangs
    return json(route, {});
  });
}

// ============================================================================
// Login / unauth
// ============================================================================

test.describe('Unauth visual audit', () => {
  test('login desktop', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: 'Bem-vindo ao ICS Select' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Entrar com Google/ }),
    ).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-login-desktop.png',
      fullPage: true,
    });
  });

  test('login mobile', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 768 });
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: 'Bem-vindo ao ICS Select' }),
    ).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-login-mobile.png',
      fullPage: true,
    });
  });

  test('privacy page + accept', async ({ page }) => {
    const pendingUser = { ...ADMIN_USER, privacyAcceptedAt: null };
    await installCommonMocks(page, pendingUser);
    await page.goto('/privacy');
    await expect(
      page.getByRole('heading', { name: 'Aviso de privacidade' }),
    ).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-privacy.png',
      fullPage: true,
    });
    await page
      .getByRole('button', { name: /Aceito e quero continuar/ })
      .click();
    // Accept POST should have been called; page may redirect away.
    await page.waitForTimeout(500);
  });
});

// ============================================================================
// Admin flows
// ============================================================================

test.describe('Admin flows', () => {
  test.beforeEach(async ({ page }) => {
    await installCommonMocks(page, ADMIN_USER);
  });

  test('/admin/dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Dashboard do Ciclo' }),
    ).toBeVisible();
    await expect(page.getByText('Performance Atual')).toBeVisible();
    await expect(page.getByText('Elite Status')).toBeVisible();
    await expect(page.getByText('On Track')).toBeVisible();
    await expect(page.getByText('Member Directory')).toBeVisible();
    await expect(page.getByText('Alice Silva')).toBeVisible();
    await expect(page.getByText('Bruno Costa')).toBeVisible();
    await expect(page.getByText('Carla Mendes')).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-dashboard.png',
      fullPage: true,
    });
  });

  test('/admin/cycles list + create modal', async ({ page }) => {
    let cyclesPostBody: Record<string, unknown> | null = null;
    await page.route('http://localhost:3001/cycles', async (route) => {
      if (route.request().method() === 'POST') {
        cyclesPostBody = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'c-new',
            status: 'ACTIVE',
            ...(cyclesPostBody ?? {}),
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(CYCLES_LIST),
        });
      }
    });

    await page.goto('/admin/cycles');
    await expect(page.getByRole('heading', { name: 'Ciclos' })).toBeVisible();
    await expect(page.getByText('2026.1')).toBeVisible();
    await expect(page.getByText('2025.2')).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-cycles-list.png',
      fullPage: true,
    });

    await page.getByRole('button', { name: 'Novo ciclo' }).click();
    // Modal opens — use the form field to detect readiness.
    await expect(page.getByLabel('Nome')).toBeVisible();
    await page.getByLabel('Nome').fill('2026.2');
    await page.getByLabel('Início').fill('2026-07-01');
    await page.getByLabel('Fim').fill('2026-12-15');
    await page.screenshot({
      path: 'test-results/audit-admin-cycles-modal.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Criar' }).click();
    await page.waitForTimeout(400);
    expect(cyclesPostBody).toMatchObject({ name: '2026.2' });
  });

  test('/admin/cycles/[id] detail', async ({ page }) => {
    await page.goto('/admin/cycles/c-2026-1');
    await expect(
      page.getByRole('heading', { name: '2026.1' }),
    ).toBeVisible();
    await expect(page.getByText(/Membros \(2\)/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Baixar relatório/ }),
    ).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-cycle-detail.png',
      fullPage: true,
    });
  });

  test('/admin/cycles/[id]/classes', async ({ page }) => {
    await page.goto('/admin/cycles/c-2026-1/classes');
    await expect(
      page.getByRole('heading', { name: 'Aulas do ciclo' }),
    ).toBeVisible();
    await expect(page.getByText('Kickoff: algoritmos de busca')).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-classes.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Nova aula' }).click();
    await expect(page.getByLabel('Título')).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-classes-modal.png',
      fullPage: true,
    });
  });

  test('/admin/library list', async ({ page }) => {
    await page.goto('/admin/library');
    await expect(page.getByRole('heading', { name: 'Acervo' })).toBeVisible();
    await expect(
      page.getByText('Two Pointers, do zero ao expert'),
    ).toBeVisible();
    await expect(page.getByText('Grafos: BFS e DFS')).toBeVisible();
    // HeroUI Button with `as={Link}` may render as button or link.
    await expect(page.getByText(/Novo item/).first()).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-library.png',
      fullPage: true,
    });
  });

  test('/admin/library/new', async ({ page }) => {
    await page.goto('/admin/library/new');
    await expect(
      page.getByRole('heading', { name: 'Novo item do acervo' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Extrair metadados/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Criar$/ }),
    ).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-library-new.png',
      fullPage: true,
    });
  });

  test('/admin/library/[id] edit', async ({ page }) => {
    await page.goto('/admin/library/li-1');
    await expect(
      page.getByRole('heading', { name: 'Editar item' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excluir' })).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-library-edit.png',
      fullPage: true,
    });
  });

  test('/admin/members list', async ({ page }) => {
    await page.goto('/admin/members');
    await expect(
      page.getByRole('heading', { name: 'Membros' }),
    ).toBeVisible();
    await expect(page.getByText('Alice Silva')).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-members.png',
      fullPage: true,
    });
  });

  test('/admin/members/[id] overview', async ({ page }) => {
    await page.goto('/admin/members/m-1');
    await expect(
      page.getByRole('heading', { name: 'Alice Silva' }),
    ).toBeVisible();
    await expect(page.getByText('Histórico de planos')).toBeVisible();
    await expect(page.getByText('Cobertura de tópicos')).toBeVisible();
    await expect(page.getByText('Diagnóstico (IA)')).toBeVisible();
    await expect(page.getByText('Chat contextual')).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-member-detail.png',
      fullPage: true,
    });
  });

  test('/admin/plans/[memberId] editor', async ({ page }) => {
    await page.goto('/admin/plans/m-1');
    await expect(
      page.getByRole('heading', { name: /Editor de plano semanal/ }),
    ).toBeVisible();
    await expect(page.getByText(/Ciclo ativo: 2026.1/)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Plano da semana' }),
    ).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-plan-editor.png',
      fullPage: true,
    });
  });

  test('/admin/ai-usage', async ({ page }) => {
    await page.goto('/admin/ai-usage');
    await expect(
      page.getByRole('heading', { name: 'Uso de IA' }),
    ).toBeVisible();
    await expect(page.getByText(/Últimos 7 dias/)).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-admin-ai-usage.png',
      fullPage: true,
    });
  });
});

// ============================================================================
// Member flows
// ============================================================================

test.describe('Member flows', () => {
  test.beforeEach(async ({ page }) => {
    await installCommonMocks(page, MEMBER_USER);
  });

  test('/me weekly plan', async ({ page }) => {
    await page.goto('/me');
    await expect(page.getByRole('heading', { name: 'Plano de Estudo Semanal' })).toBeVisible();
    await expect(page.getByText('Progresso Semanal')).toBeVisible();
    await expect(page.getByText('Módulos da Semana')).toBeVisible();
    await expect(page.getByText('Recursos Adicionais')).toBeVisible();
    await expect(page.getByText('Flashcards Master')).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-me-home.png',
      fullPage: true,
    });
  });

  test('/me/availability form + save', async ({ page }) => {
    let patchBody: Record<string, unknown> | null = null;
    await page.route(
      'http://localhost:3001/me/availability',
      async (route) => {
        const method = route.request().method();
        if (method === 'PATCH') {
          patchBody = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...AVAILABILITY, ...(patchBody ?? {}) }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(AVAILABILITY),
          });
        }
      },
    );

    await page.goto('/me/availability');
    await expect(
      page.getByRole('heading', { name: 'Disponibilidade semanal' }),
    ).toBeVisible();
    for (const day of [
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
      'Domingo',
    ]) {
      await expect(page.getByText(day, { exact: true })).toBeVisible();
    }
    await page.screenshot({
      path: 'test-results/audit-me-availability.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Salvar' }).click();
    await page.waitForTimeout(400);
    expect(patchBody).not.toBeNull();
  });

  test('/me/plan/[planId]/item/[itemId] detail', async ({ page }) => {
    let doneBody: Record<string, unknown> | null = null;
    await page.route(
      /^http:\/\/localhost:3001\/plans\/[^/]+\/items\/[^/]+\/done$/,
      async (route) => {
        doneBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      },
    );

    await page.goto('/me/plan/p-week-1/item/pi-2');
    await expect(page.getByRole('heading', { name: 'Grafos: BFS e DFS' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fácil' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Difícil' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Travei' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar feito' })).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-me-item-detail.png',
      fullPage: true,
    });

    await page.getByRole('button', { name: 'Fácil' }).click();
    await page.getByRole('button', { name: 'Marcar feito' }).click();
    await page.waitForTimeout(400);
    expect(doneBody).toMatchObject({ rating: 'EASY' });
  });
});

// ============================================================================
// Shell / Navigation
// ============================================================================

test.describe('Shell / Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await installCommonMocks(page, ADMIN_USER);
  });

  test('sidebar shows all admin nav items (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/dashboard');
    for (const label of [
      'Dashboard',
      'Ciclos',
      'Membros',
      'Acervo',
      'Uso de IA',
    ]) {
      await expect(
        page.getByRole('link', { name: label }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: 'test-results/audit-shell-desktop.png',
      fullPage: true,
    });
  });

  test('mobile drawer opens', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 768 });
    await page.goto('/admin/dashboard');
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Menu de navegação' }),
    ).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-shell-mobile-drawer.png',
      fullPage: true,
    });
  });

  test('logout calls API', async ({ page }) => {
    let logoutCalled = false;
    await page.route('http://localhost:3001/auth/logout', async (route) => {
      logoutCalled = true;
      await route.fulfill({ status: 204, body: '' });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/dashboard');
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.waitForTimeout(500);
    expect(logoutCalled).toBe(true);
  });
});
