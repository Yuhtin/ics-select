# Waitlist — persistência + painel admin

**Date:** 2026-04-20
**Scope:** one PR. Frontend + backend + one Prisma migration that also retires the dead `interest` module.

## Problem

A landing pública (`/`) tem uma modal "Entrar na lista de espera" (`apps/web/components/landing/waitlist-modal.tsx`) que coleta 7 campos (nome, email, curso, GitHub, LinkedIn, nível de programação 1-5, checkbox de updates) e **apenas muda o estado local para `'success'` sem fazer requisição alguma**. Todo candidato que clica em "Entrar na lista" vê a tela de confirmação e os dados são descartados.

Consequência imediata: não temos lista de interessados pro Ciclo 2026.3 (abre em Julho). O admin não tem como saber quantos são, de quais cursos, qual o pipeline.

Existe um módulo legado `apps/api/src/interest/` com um `POST /interest` público que aceita apenas `{ name, email }` e escreve em `InterestSubmission`. **Nenhum código do `apps/web` chama esse endpoint** (grep `/interest` e `/api/interest` em `apps/web` retorna zero matches). É sobra da landing v1 antes do redesign da modal. Vamos aposentar junto.

## Goals

- Persistir toda submissão da modal na tabela `WaitlistEntry` com upsert por email (decisão de brainstorm: usuário que reenvia por dúvida atualiza em vez de ver erro).
- Expor `/admin/waitlist` (tabela + filtros + busca + CSV) e um mini-card no `/admin` home com "X inscritos · +Y esta semana".
- Proteção mínima contra abuse: `@nestjs/throttler` (5 req/10min por IP) + honeypot field (`website`) no DTO — bot que preenche recebe 200 OK mas nada é gravado.
- Aposentar o módulo `interest` inteiro (controller + module + import em `AppModule`). Renomear `InterestSubmission → WaitlistEntry` + adicionar colunas novas numa única migração.
- LGPD-friendly: não armazenar IP bruto, só `ipHash` (SHA-256).

## Non-goals

- **Nenhum provider de email.** Sem confirmação transacional, sem broadcast "ciclo aberto". Quando chegar a hora de avisar a lista (Julho/2026), admin exporta CSV e manda por Resend Broadcasts / Loops / qualquer ferramenta externa. Isso fica pra v2 se justificar.
- **Sem CAPTCHA.** Domínio não está em lista de alvos conhecidos de bot; rate-limit + honeypot cobrem 99% de script kiddie. Turnstile fica pra quando virar problema real.
- **Sem status/convite/arquivamento** no `WaitlistEntry`. O admin hoje ainda não tem fluxo de convite automatizado, então "marcar como convidada" é ruído. V2.
- **Sem correção global do gap `ZodError → 500` mencionado no CLAUDE.md.** Escopo amarrado: esse módulo trata `ZodError` no controller retornando 400 corretamente, mas não refatora o `HttpExceptionFilter`.
- **Sem multi-ciclo avançado.** O campo `cycleTarget` é string livre e aceita qualquer valor; não há tabela `Cycle` FK. V1 serve pro 2026.3 e os próximos, sem mudança de código.

## Architecture

### 1. Data model

Nova migração `k_rename_interest_to_waitlist` (letra `k` segue a sequência `a_..j_`, confirmado em `packages/prisma/prisma/migrations/`).

A migração faz:

1. `ALTER TABLE "InterestSubmission" RENAME TO "WaitlistEntry"` — preserva qualquer linha que tenha (produção hoje está vazia de facto pois nada chama `/interest`, mas rename é reversível e grátis).
2. Drop do index antigo `InterestSubmission_email_idx`.
3. `ALTER TABLE "WaitlistEntry" ADD COLUMN` para cada campo novo. Todos nullable inicialmente pra não explodir caso haja linhas residuais.
4. Backfill de valores sentinela em colunas que viram NOT NULL (se houver linhas): `course = 'CIENCIA_COMPUTACAO'`, `skillLevel = 1`, `cycleTarget = '2026.3'`. Prisma gera esse step quando transforma nullable em NOT NULL em um segundo SQL; aqui fazemos na mesma migração com `UPDATE ... WHERE col IS NULL`.
5. `CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email")` — upsert por email requer uniqueness. Se prod tiver duplicatas (improvável, tabela morta), migração falha e a gente dedup manual antes; melhor falhar alto do que corromper.
6. `CREATE INDEX "WaitlistEntry_cycleTarget_createdAt_idx"` + `CREATE INDEX "WaitlistEntry_course_idx"` — o `course` suporta o filtro exposto em v1. O composto `(cycleTarget, createdAt)` **não** serve filtro em v1 (a página lista todos os ciclos misturados), mas future-proof pro V2 quando houver múltiplos ciclos ativos simultaneamente e a view admin segmentar por ciclo — custo é desprezível (tabela de 12-100 linhas).
7. `CREATE TYPE "Course" AS ENUM (...)` antes dos ADD COLUMN.

Schema final:

```prisma
enum Course {
  CIENCIA_COMPUTACAO
  ADMINISTRACAO
  ENGENHARIA_SOFTWARE
  ENGENHARIA_COMPUTACAO
  SISTEMAS_INFORMACAO
}

model WaitlistEntry {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  course       Course
  skillLevel   Int              // 1..5, validado no controller
  github       String?
  linkedin     String?
  wantsUpdates Boolean  @default(true)
  cycleTarget  String           // ex: "2026.3"
  ipHash       String?          // SHA-256 do IP (LGPD-friendly)
  userAgent    String?          // truncado em 255 chars
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([cycleTarget, createdAt])
  @@index([course])
}
```

O model `InterestSubmission` some do `schema.prisma`.

### 2. API

Novo módulo `apps/api/src/waitlist/` seguindo padrão Nest do projeto: `waitlist.module.ts`, `waitlist.controller.ts`, `admin-waitlist.controller.ts`, `waitlist.service.ts`, `dto/submit-waitlist.dto.ts`, `dto/list-waitlist.query.ts`, e specs jest unit + e2e.

Endpoints:

| Método  | Rota                       | Guard           | Resposta                                                                                         |
|---------|----------------------------|-----------------|--------------------------------------------------------------------------------------------------|
| `POST`  | `/waitlist`                | `@Public()`     | 200 `{ ok: true }` no happy path e no honeypot (silent drop). 400 `{ error: { code: 'VALIDATION_FAILED', details } }` pra body inválido. 429 `{ error: { code: 'TOO_MANY_REQUESTS' } }` pelo throttler quando IP excede. |
| `GET`   | `/admin/waitlist`          | `@Roles('ADMIN')` | `{ items, total, page, pageSize }` — paginação `?page=1&pageSize=50`, filtros `?course=&skillMin=&skillMax=&wantsUpdates=&q=`. |
| `GET`   | `/admin/waitlist/stats`    | `@Roles('ADMIN')` | `{ total, last7d, wantsUpdatesPct, byCourse, bySkill }` — alimenta o mini-card no `/admin` home. |
| `GET`   | `/admin/waitlist/export`   | `@Roles('ADMIN')` | `text/csv` stream, `Content-Disposition: attachment; filename="waitlist-YYYYMMDD.csv"`.          |

DTO de submissão (Zod, validado no controller):

```ts
const SubmitWaitlistSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(200),
  course: z.enum(['CIENCIA_COMPUTACAO', 'ADMINISTRACAO', 'ENGENHARIA_SOFTWARE', 'ENGENHARIA_COMPUTACAO', 'SISTEMAS_INFORMACAO']),
  skillLevel: z.number().int().min(1).max(5),
  github: z.string().trim().url().max(500).optional().or(z.literal('').transform(() => undefined)),
  linkedin: z.string().trim().url().max(500).optional().or(z.literal('').transform(() => undefined)),
  wantsUpdates: z.boolean().default(true),
  cycleTarget: z.string().regex(/^\d{4}\.\d$/).max(10),  // "2026.3"
  website: z.string().optional(),                          // honeypot — se vier preenchido, service descarta
});
```

Service:

- `submit(dto, ipHash, userAgent)` — se `dto.website` é string não vazia, `return { ok: true }` sem tocar o DB. Caso contrário `prisma.waitlistEntry.upsert({ where: { email }, create, update })` (decisão B do brainstorm). O payload de `update` é **idêntico** ao de `create` exceto `email` (unique) — "latest submission wins", incluindo `cycleTarget` (se reenviar quando 2026.4 estiver aberto, quer ser avisada do próximo). `createdAt` é preservado pelo Prisma no update; `updatedAt` avança via `@updatedAt`. `ipHash` é SHA-256 de `x-forwarded-for` (primeiro IP) ou `req.ip`. `userAgent` é `req.headers['user-agent']?.slice(0, 255)`.
- `list(query)` — paginação com `skip/take`, filtros opcionais, busca `q` vira `WHERE (name ILIKE %q% OR email ILIKE %q%)`. Ordena `createdAt DESC`.
- `stats()` — 5 counts em paralelo via `Promise.all`:
  - `count()` total
  - `count({ where: { createdAt: { gte: sevenDaysAgo } } })`
  - `count({ where: { wantsUpdates: true } })` pra derivar pct
  - `groupBy({ by: ['course'], _count })`
  - `groupBy({ by: ['skillLevel'], _count })`
- `exportCsv()` — retorna um stream Node (`Readable`) que itera `prisma.waitlistEntry.findMany({ orderBy: createdAt DESC })` em cursor-based chunks de 500 e escreve linhas CSV. Header: `createdAt,name,email,course,skillLevel,github,linkedin,wantsUpdates,cycleTarget`. Sem BOM — planilhas modernas (Google Sheets, Numbers, Excel 2016+) abrem UTF-8 direto.

Abuse prevention:

- `@nestjs/throttler` (nova dep) registrado como guard global opcional — via `@Throttle({ default: { limit: 5, ttl: 600000 } })` no `POST /waitlist`, sem `@UseGuards(ThrottlerGuard)` global. Os demais endpoints admin ficam sem throttle (não há impacto em tráfego existente). Não requer variável de ambiente nova.
- Honeypot tratado no service antes do upsert, como descrito. Bot que bate o throttle já não chega a ver resposta; bot que chega e preenche o honeypot recebe 200 e pensa que foi.
- **Trust proxy:** `apps/api/src/main.ts` hoje **não** configura `app.set('trust proxy', ...)`. Atrás do EasyPanel + Cloudflare o `req.ip` vai refletir o proxy, não o cliente, e o throttler agruparia todo mundo num único balde. Adicionar `app.set('trust proxy', 1)` logo após `NestFactory.create(...)` (via `(app.getHttpAdapter().getInstance() as Express).set(...)`) faz parte desse PR — escopo pequeno mas necessário pro rate-limit funcionar.

Exception handling neste módulo: `ZodError` capturado no controller com try/catch → `BadRequestException` com envelope `{ error: { code: 'VALIDATION_FAILED', message, details } }`. Isso evita o gap `ZodError → 500` do `HttpExceptionFilter` só neste módulo. Refator global do filter fica explicitamente fora de escopo.

### 3. Frontend — modal da landing

`apps/web/components/landing/waitlist-modal.tsx` ganha estado `'form' | 'submitting' | 'success' | 'error'` (hoje só `'form' | 'success'`). `handleSubmit`:

```ts
const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setState('submitting');
  const formData = new FormData(e.currentTarget);
  const payload = {
    name: formData.get('name'),
    email: formData.get('email'),
    course: mapCourseLabelToEnum(formData.get('course')),  // "Ciência da Computação" → "CIENCIA_COMPUTACAO"
    skillLevel: Number(formData.get('skill')),
    github: formData.get('github') || undefined,
    linkedin: formData.get('linkedin') || undefined,
    wantsUpdates: formData.get('updates') === 'on',
    cycleTarget: process.env.NEXT_PUBLIC_WAITLIST_CYCLE ?? '2026.3',
    website: formData.get('website') ?? '',  // honeypot
  };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'request_failed'));
    setState('success');
  } catch {
    setState('error');
  }
};
```

Mudanças visuais mínimas:

- Campo hidden honeypot `<input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0" />` dentro do form, fora do fluxo visual.
- Botão "Entrar na lista" fica disabled quando `state === 'submitting'` com texto "Enviando…".
- Se `state === 'error'`, renderizar uma linha abaixo do botão (`text-danger text-xs mt-1`): "Não foi possível enviar. Tenta de novo em instantes." — sem modal separada.
- Mapa label→enum em `apps/web/lib/waitlist/course.ts` (exportado pra reuso em tests e futuras páginas).

O `state === 'success'` atual (tela "Você está na lista.") permanece idêntico visualmente.

`NEXT_PUBLIC_API_URL` já existe (reuso). `NEXT_PUBLIC_WAITLIST_CYCLE` é var nova, com fallback `'2026.3'` no código. Documentar no `.env.example` do `apps/web`.

### 4. Frontend — painel admin

Nova rota `apps/web/app/(admin)/admin/waitlist/page.tsx` (Client Component, segue o padrão de `/admin/library`). Usa HeroUI `Table` e TanStack Query — mesmos building blocks do restante do admin.

Componentes:

```
components/admin/waitlist/
  waitlist-stats.tsx      // 4 cards: total · últimos 7d · quer updates (%) · cursos distintos
  waitlist-filters.tsx    // chips de curso + range slider skill 1-5 + toggle updates + busca
  waitlist-table.tsx      // colunas: data, nome, email, curso, skill (5 bolinhas), links (ícones), updates (check)
  waitlist-export-button.tsx  // <Button onPress={() => window.location.href = '/admin/waitlist/export'} />
```

Tipografia: **Source Serif 4** (surface dense-data), `font-variant-numeric: tabular-nums` nos números. Segue `docs/design-system.md`. Sem box-shadow, separação por `1px rule`.

Mini-card no `/admin` home: componente `<WaitlistHomeCard />` adicionado à grid existente do dashboard admin. Consome `/admin/waitlist/stats` via `useQuery`. Se `total === 0`, mostra placeholder "Nenhum inscrito ainda" e link pra página. Senão, "X inscritos · +Y esta semana" com link.

Todas as chamadas ao backend usam `apps/web/lib/api/waitlist.ts` (client helper que injeta cookies e usa `NEXT_PUBLIC_API_URL`).

### 5. Cleanup do módulo `interest`

No mesmo PR:

- Deletar `apps/api/src/interest/interest.controller.ts` e `interest.module.ts`.
- Remover `InterestModule` de `apps/api/src/app.module.ts` (import + entrada no array `imports`).
- Remover `model InterestSubmission` de `packages/prisma/schema.prisma` (a migração já renomeia a tabela no Postgres).
- Nenhuma mudança necessária no frontend (já confirmado: nada chama `/interest`).

## Data flow

### Submissão (caminho feliz)

```
Landing modal
  → POST /waitlist (NEXT_PUBLIC_API_URL) com payload validado
  → @nestjs/throttler (5/10min por IP)
  → WaitlistController.submit
    → Zod parse (400 se inválido)
    → WaitlistService.submit(dto, ipHash, userAgent)
      → se dto.website preenchido → return { ok: true } (silent drop)
      → prisma.waitlistEntry.upsert({ where: { email }, create, update })
    → return { ok: true }
Modal → setState('success') → tela "Você está na lista."
```

### Admin lista

```
/admin/waitlist page
  → useQuery(['waitlist', filters, page]) → GET /admin/waitlist?course=&skillMin=&q=&page=
  → JwtAuthGuard + RolesGuard(ADMIN) → AdminWaitlistController.list
  → service.list(query) → prisma.waitlistEntry.findMany/count em paralelo
  → { items, total, page, pageSize }
Table renderiza, filtros atualizam state, Query re-fetch.
```

### Export CSV

```
/admin/waitlist page → Botão "Export CSV"
  → window.location.href = `${API_URL}/admin/waitlist/export`  (cookie sessão já vai junto)
  → AdminWaitlistController.export retorna Readable stream
    → res.setHeader('Content-Type', 'text/csv')
    → res.setHeader('Content-Disposition', 'attachment; filename="waitlist-YYYYMMDD.csv"')
    → cursor-based findMany em chunks de 500, escreve linhas escapadas
Browser abre download.
```

## Error handling

| Cenário                          | API resposta                                                                 | Modal/Admin UX                                   |
|----------------------------------|------------------------------------------------------------------------------|--------------------------------------------------|
| Zod invalid body                 | 400 `{ error: { code: 'VALIDATION_FAILED', details } }`                      | Modal → `state='error'`, linha genérica abaixo do botão. Não expomos `details` pro usuário (só loga no backend). |
| Throttle exceeded                | 429 `{ error: { code: 'TOO_MANY_REQUESTS' } }`                               | Modal → `state='error'`, mesma linha genérica.   |
| Honeypot preenchido              | 200 `{ ok: true }` (silent drop)                                             | Bot vê sucesso; nada gravado.                    |
| Email unique constraint race     | Upsert, não dá conflito por desenho.                                         | n/a                                              |
| DB down / Prisma error           | 500 via HttpExceptionFilter                                                  | Modal → `state='error'`, linha genérica.         |
| Admin não autenticado            | 401 via JwtAuthGuard                                                         | Admin shell redireciona pra `/login`.            |
| Admin sem role                   | 403 via RolesGuard                                                           | Página mostra "Acesso negado".                   |

Linhas CSV escapadas com aspas duplas e escape de `"` (padrão RFC 4180). Campos nulos viram string vazia.

## Edge cases

- **Email com upper case** — `z.string().toLowerCase()` no Zod normaliza antes do upsert, então `Rio@foo.com` e `rio@foo.com` viram 1 registro.
- **GitHub/LinkedIn vazios** — form manda `""`, Zod converte pra `undefined` (`.or(z.literal('').transform(...))`); DB armazena `NULL`. No CSV aparece como célula vazia.
- **Trocar curso ao reenviar** — upsert sobrescreve `course` + `skillLevel` + links com os valores mais novos. `createdAt` preservado, `updatedAt` avança. Admin consegue distinguir as duas datas na tabela (coluna "registrado" mostra `createdAt`; tooltip/hover mostra `updatedAt` quando diferente).
- **Cliente sem `x-forwarded-for`** — com `trust proxy` ativo (configurado nesse PR, ver seção de Abuse prevention), `req.ip` pega o IP do header quando existe e cai pro IP do socket caso contrário. `ipHash` armazena SHA-256 do que vier; nunca fica vazio.
- **Produção com linhas residuais em `InterestSubmission`** — rename preserva; colunas novas NOT NULL recebem backfill sentinela (`course = 'CIENCIA_COMPUTACAO'`, `skillLevel = 1`, `cycleTarget = '2026.3'`). Email residual duplicado falha a migração com erro claro antes do `CREATE UNIQUE INDEX` — se acontecer em staging, dedup manual antes do prod deploy (provavelmente zero linhas, mas vale cobrir).
- **Export CSV com 10k+ linhas** — cursor pagination mantém memória constante; Nest stream direto via `res.write`. Fica aceitável até 6 dígitos de linhas, muito além do escopo de 12 vagas/ciclo.

## Testing

### API unit (jest)

`apps/api/src/waitlist/waitlist.service.spec.ts`:

- `submit(dto, ...)` novo email → `prisma.waitlistEntry.upsert` chamado com `where: { email }`, `create` e `update` com payloads equivalentes (sem `email` no update).
- `submit(dto, ...)` email existente com `cycleTarget` novo → o `update` passa o `cycleTarget` novo (latest-wins).
- `submit({ website: 'filled' })` → prisma NUNCA chamado, retorna `{ ok: true }`.
- `submit` normaliza email (`"  Foo@BAR.com "` → `"foo@bar.com"`).
- `list({ course, q, skillMin })` → monta `where` correto com `AND` de filtros + `OR` de busca.
- `stats()` → 5 queries em paralelo, monta objeto `{ total, last7d, wantsUpdatesPct, byCourse, bySkill }`.

`apps/api/src/waitlist/waitlist.controller.spec.ts`:

- `POST /waitlist` body válido → 200 `{ ok: true }`.
- `POST /waitlist` body inválido (email malformado) → 400 com `code: 'VALIDATION_FAILED'`.
- `POST /waitlist` body com `website` → 200 `{ ok: true }` (delega ao service).

`apps/api/src/waitlist/admin-waitlist.controller.spec.ts`:

- `GET /admin/waitlist` sem auth → 401.
- `GET /admin/waitlist` user MEMBER → 403.
- `GET /admin/waitlist` ADMIN com query → 200 com `items` + paginação.
- `GET /admin/waitlist/export` ADMIN → header `Content-Type: text/csv`, stream escapa aspas corretamente.

### API e2e (jest)

`apps/api/test/waitlist.e2e-spec.ts`:

- Sobe `AppModule` com Prisma mockado, posta body completo em `/waitlist`, verifica 200.
- Segunda chamada com mesmo email altera registro (verificado via mock assertions sobre `upsert`).
- Ping com throttle limit simulado (5 posts em sequência) → sexta chamada retorna 429.

### Frontend Playwright

`apps/web/tests/waitlist-modal.spec.ts` (novo):

- Abre landing, clica no CTA que abre modal (`data-testid="waitlist-open"` no botão da landing — adicionar se não existir).
- Preenche os 6 campos visíveis (incluindo clicar no botão de skill 4), **não** preenche o campo honeypot (que está off-screen mesmo).
- Intercepta `POST **/waitlist` com `page.route()` retornando `{ ok: true }`.
- Valida que state muda pra success e aparece "Você está na lista.".
- Segundo teste: intercepta com 500 → valida linha de erro visível.

Não adicionamos Playwright pro `/admin/waitlist` nesse PR — admin tem 0 cobertura Playwright atualmente; seguir o padrão.

### Manual smoke (pré-merge)

1. Preview Vercel + API staging: submete pela modal real, vê no `/admin/waitlist`.
2. Reenvia mesmo email com curso diferente → linha atualizada, não duplicada.
3. Export CSV → abre no Google Sheets sem quebrar separador.
4. Tenta submeter 6x em 1 minuto → 6ª vê linha de erro.

## Rollout

1. PR entra → CI roda (Postgres+pgvector service já configurado, migração aplica).
2. Merge em `main` → workflow `deploy.yml` publica imagem `ghcr.io/yuhtin/ics-select-api:latest`.
3. EasyPanel pull → `docker-entrypoint.sh` roda `prisma migrate deploy` → migração `k_rename_interest_to_waitlist` aplica.
4. Vercel pega push do `apps/web` automaticamente — deploy paralelo.
5. Set `NEXT_PUBLIC_WAITLIST_CYCLE=2026.3` na Vercel (Production + Preview). Se ficar sem setar, fallback `'2026.3'` no código cobre.
6. Smoke test em produção: submeter email de teste (rio.daviduarte+waitlist-test@gmail.com), verificar no `/admin/waitlist`, apagar a linha de teste via SQL ou botão admin (não tem botão; SQL). **Aceita que precise de um `DELETE` manual no Postgres pra limpar teste — não vale criar feature de delete pra v1.**

Rollback plan: se a migração der pau em prod (extremamente improvável), `prisma migrate resolve --rolled-back k_rename_interest_to_waitlist` + SQL manual de reverse rename. Frontend antigo (que já era mock) continua funcionando enquanto API volta.

## Out of scope (V2 candidates, com ordem sugerida)

1. **Email de confirmação transacional** via Resend/Loops quando uma inscrição entra. Template pt-BR + link de unsubscribe se `wantsUpdates=true`. Custa ~meio dia + provider setup.
2. **Broadcast "ciclo aberto"** — endpoint admin `POST /admin/waitlist/broadcast` que dispara pra quem tem `wantsUpdates=true` e `cycleTarget` no próximo. Precisa fila ou só chamada síncrona com loop — depende do volume.
3. **Status no registro** (`PENDING | INVITED | ACCEPTED | REJECTED | ARCHIVED`) pra rastrear quem foi convertido em `User`. Liga o funil ao admin de membros.
4. **Notas internas por inscrito** (`adminNotes: String?`) pro diretor fazer triagem qualitativa antes do convite.
5. **Turnstile/hCaptcha** se o honeypot começar a falhar.

Cada um desses vira spec separada quando justificar.
